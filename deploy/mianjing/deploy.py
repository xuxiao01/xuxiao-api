"""Isolated deployment. Never writes or restarts the existing shared API."""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tarfile
import time
import urllib.request

ROOT = Path('/www/wwwroot/mianjing-api')
BACKUPS = Path('/www/backup/mianjing-deploy')
NGINX = Path('/www/server/nginx/sbin/nginx')
SITE = Path('/www/server/panel/vhost/nginx/xuxiaoapi.online.conf')
INCLUDE = Path('/www/server/panel/vhost/nginx/includes/mianjing-api.conf')
URL = 'https://xuxiaoapi.online'
SHARED_ENV = Path('/www/wwwroot/xuxiao-api/.env')


def run(args, **kwargs):
    return subprocess.run(args, check=True, **kwargs)


def request(url, token=None, body=None):
    headers={'Cache-Control':'no-cache'}
    if token: headers['Authorization']='Bearer '+token
    if body is not None:headers['Content-Type']='application/json'
    req=urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers)
    with urllib.request.urlopen(req,timeout=15) as res:
        return json.load(res)


def latest(sha):
    current=request('https://api.github.com/repos/xuxiao01/xuxiao-api/git/ref/heads/main')['object']['sha']
    if current!=sha:raise RuntimeError('main advanced; refusing outdated release')


def processes():
    result=subprocess.check_output(['/usr/bin/pm2','jlist'],text=True)
    return {p['name']:p['pid'] for p in json.loads(result) if p['name'] in ('xuxiao-api','script-hub')}


def ready(origin,sha):
    value=request(origin+'/api/mianjing/health')
    if value.get('data')!={'status':'ready','apiVersion':1,'commit':sha}:raise RuntimeError('API readiness or commit mismatch')
    guest=request(origin+'/api/mianjing/auth/guest',body={})['data']['token']
    me=request(origin+'/api/mianjing/me',token=guest)['data']
    if me!={'role':'guest','user':None,'isAdmin':False,'canEdit':False}:raise RuntimeError('Guest permissions incorrect')
    request(origin+'/api/mianjing/questions',token=guest)
    request(origin+'/api/mianjing/company-catalog',token=guest)


def switch(target):
    link=ROOT/'.current-next'
    link.unlink(missing_ok=True)
    link.symlink_to(target)
    os.replace(link,ROOT/'current')


def extract(archive,target):
    with tarfile.open(archive) as tar:
        for member in tar.getmembers():
            p=Path(member.name)
            if p.is_absolute() or '..' in p.parts or not (member.isfile() or member.isdir()):raise ValueError('Unsafe artifact entry')
            if p.parts and p.parts[0] not in ('dist','prisma','deploy','package.json','pnpm-lock.yaml','prisma.config.ts','release.json'):raise ValueError('Unexpected artifact path')
        tar.extractall(target,filter='data')


def deploy(sha,upload,expected):
    if not re.fullmatch('[0-9a-f]{40}',sha) or not re.fullmatch('[0-9a-f]{40}-[0-9]+-[0-9]+',upload):raise ValueError('Invalid release identity')
    incoming=ROOT/'incoming'/upload
    artifact=incoming/'app.tgz'
    if hashlib.sha256(artifact.read_bytes()).hexdigest()!=expected:raise ValueError('Artifact checksum mismatch')
    latest(sha)
    baseline=processes()
    env_digest=hashlib.sha256(SHARED_ENV.read_bytes()).hexdigest()
    backup=BACKUPS/upload
    backup.mkdir(parents=True,mode=0o700)
    (backup/'baseline.json').write_text(json.dumps({'processes':baseline,'sharedEnvDigest':env_digest}))
    stage=incoming/'prepared'
    stage.mkdir()
    extract(artifact,stage)
    if json.loads((stage/'release.json').read_text())!={'commit':sha}:raise ValueError('Artifact version mismatch')
    private=ROOT/'shared'/('env-'+sha)
    private.write_bytes((ROOT/'shared/.env').read_bytes()+('\nRELEASE_SHA='+sha+'\n').encode())
    shutil.chown(private,user='root',group='mianjing-api')
    private.chmod(0o640)
    (stage/'.env').symlink_to(private)
    install_env={**os.environ,'CI':'true','NPM_CONFIG_REGISTRY':'https://registry.npmmirror.com/','PNPM_CONFIG_REGISTRY':'https://registry.npmmirror.com/'}
    run(['/usr/bin/npm','exec','--yes','--package=pnpm@10.13.1','--','pnpm','install','--frozen-lockfile','--config.confirmModulesPurge=false'],cwd=stage,env=install_env)
    latest(sha)
    run(['/usr/bin/node','deploy/mianjing/migrate.cjs'],cwd=stage,env={**install_env,'MIANJING_BACKUP_DIR':str(backup)})
    release=ROOT/'releases'/upload
    stage.rename(release)
    previous=(ROOT/'current').resolve() if (ROOT/'current').is_symlink() else None
    old_site=SITE.read_bytes()
    old_include=INCLUDE.read_bytes() if INCLUDE.exists() else None
    changed_nginx=False
    try:
        latest(sha)
        switch(release)
        run(['systemctl','restart','mianjing-api.service'])
        for attempt in range(30):
            try:
                ready('http://127.0.0.1:3301',sha)
                break
            except Exception:
                if attempt==29:raise
                time.sleep(1)
        config=(release/'deploy/mianjing/nginx.conf').read_bytes()
        include_line='    include '+str(INCLUDE)+';'
        text=old_site.decode()
        if config!=old_include or include_line not in text:
            (backup/'nginx-site.conf').write_bytes(old_site)
            if old_include is not None:(backup/'nginx-include.conf').write_bytes(old_include)
            changed_nginx=True
            INCLUDE.write_bytes(config)
            if include_line not in text:
                pos=text.rfind('}')
                if pos<0:raise RuntimeError('Invalid site configuration')
                SITE.write_text(text[:pos]+include_line+'\n'+text[pos:])
            run([str(NGINX),'-t'])
            run([str(NGINX),'-s','reload'])
        ready(URL,sha)
        if processes()!=baseline:raise RuntimeError('Existing process changed during release')
        if hashlib.sha256(SHARED_ENV.read_bytes()).hexdigest()!=env_digest:raise RuntimeError('Shared environment changed')
        run(['systemctl','enable','mianjing-api.service'])
    except BaseException:
        if changed_nginx:
            SITE.write_bytes(old_site)
            if old_include is None:INCLUDE.unlink(missing_ok=True)
            else:INCLUDE.write_bytes(old_include)
            run([str(NGINX),'-t'])
            run([str(NGINX),'-s','reload'])
        if previous:
            switch(previous)
            run(['systemctl','restart','mianjing-api.service'])
        else:
            run(['systemctl','stop','mianjing-api.service'])
            (ROOT/'current').unlink(missing_ok=True)
        raise
    # Keep five versions, always preserving current and the previous healthy version.
    versions=sorted((p for p in (ROOT/'releases').iterdir() if p.is_dir()),key=lambda p:p.stat().st_mtime,reverse=True)
    keep=set(versions[:5])|{release,previous}
    for version in versions:
        if version not in keep:shutil.rmtree(version)
    print('Published isolated mianjing API '+sha)


if __name__=='__main__':
    ROOT.mkdir(exist_ok=True)
    with (ROOT/'.deploy.lock').open('w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        deploy(*sys.argv[1:])
