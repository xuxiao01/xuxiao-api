"""One-time setup only; no running process or Nginx configuration is changed."""
from pathlib import Path
import os
import pwd
import shutil
import subprocess

ROOT=Path('/www/wwwroot/mianjing-api')
try:
    pwd.getpwnam('mianjing-api')
except KeyError:
    subprocess.run(['useradd','--system','--home-dir',str(ROOT),'--shell','/sbin/nologin','mianjing-api'],check=True)
for name in ('incoming','releases','shared','shared/migration-history'):
    p=ROOT/name
    p.mkdir(parents=True,exist_ok=True)
    p.chmod(0o755)
shutil.chown(ROOT/'shared',user='root',group='mianjing-api')
(ROOT/'shared').chmod(0o750)
if not (ROOT/'shared/.env').exists():
    script=r'''
const fs=require('node:fs'),crypto=require('node:crypto');
const dotenv=require('/www/wwwroot/xuxiao-api/node_modules/dotenv');
const {serializeEnvironment}=require(process.argv[1]);
const source=dotenv.parse(fs.readFileSync('/www/wwwroot/xuxiao-api/.env'));
if(!source.DATABASE_URL || !source.JWT_SECRET)throw new Error('Existing authentication configuration missing');
const env={DATABASE_URL:source.DATABASE_URL,JWT_SECRET:source.JWT_SECRET,JWT_EXPIRES_IN:source.JWT_EXPIRES_IN||'7d',MIANJING_ADMIN_USER_ID:'2',MIANJING_GUEST_JWT_SECRET:crypto.randomBytes(48).toString('base64url'),PORT:'3301',APP_MODULES:'mianjing'};
fs.writeFileSync('/www/wwwroot/mianjing-api/shared/.env',serializeEnvironment(env,dotenv.parse),{mode:0o640,flag:'wx'});
'''
    subprocess.run(['/usr/bin/node','-e',script,str(Path(__file__).with_name('env.cjs').resolve())],check=True)
    shutil.chown(ROOT/'shared/.env',user='root',group='mianjing-api')
    (ROOT/'shared/.env').chmod(0o640)
unit=Path('/etc/systemd/system/mianjing-api.service')
expected=Path(__file__).with_name('mianjing-api.service').read_bytes()
if unit.exists() and unit.read_bytes()!=expected:
    raise RuntimeError('Existing unit differs; review before replacement')
unit.write_bytes(expected)
unit.chmod(0o644)
subprocess.run(['systemctl','daemon-reload'],check=True)
backup=Path('/www/backup/mianjing-deploy')
backup.mkdir(parents=True,exist_ok=True,mode=0o700)
backup.chmod(0o700)
print('Configured isolated account, private environment and unit; no service restarted')
