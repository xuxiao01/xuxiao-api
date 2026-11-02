import unittest
from classify import classify


class ClassifierTests(unittest.TestCase):
    def test_isolated_scope(self):
        self.assertEqual(classify('feat(mianjing): 上线', ['src/modules/mianjing/mianjing.routes.ts', 'src/app.ts']), 'mianjing')

    def test_shared_unchanged(self):
        self.assertEqual(classify('feat(crush-date): 更新', ['src/modules/crush-date/a.ts']), 'shared')

    def test_cross_product_rejected(self):
        with self.assertRaises(ValueError):
            classify('feat(mianjing): 上线', ['tests/crush-date-content-item-migration.test.ts'])
        with self.assertRaises(ValueError):
            classify('feat(mianjing): 上线', ['prisma/migrations/20261025000000_add_ningxia_content_item_cities/migration.sql'])


if __name__ == '__main__':
    unittest.main()

class ArtifactTests(unittest.TestCase):
    def test_reject_escaping_and_link_entries(self):
        import io, tarfile, tempfile
        from pathlib import Path
        from deploy import extract
        for name, kind in [('../escape',tarfile.REGTYPE),('dist/link',tarfile.SYMTYPE)]:
            with tempfile.TemporaryDirectory() as directory:
                root=Path(directory)
                archive=root/'test.tgz'
                with tarfile.open(archive,'w:gz') as tar:
                    info=tarfile.TarInfo(name);info.type=kind;info.linkname='/etc/passwd';tar.addfile(info,io.BytesIO(b''))
                with self.assertRaises(ValueError):extract(archive,root/'output')

    def test_failed_release_restores_previous_without_touching_shared_api(self):
        import hashlib, io, json, tarfile, tempfile
        from pathlib import Path
        from unittest.mock import patch
        import deploy
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);sha='a'*40;upload=sha+'-1-1'
            incoming=root/'incoming'/upload;incoming.mkdir(parents=True)
            (root/'releases/previous').mkdir(parents=True)
            (root/'current').symlink_to(root/'releases/previous')
            (root/'shared').mkdir();(root/'shared/.env').write_text('test-only')
            shared=root/'existing.env';shared.write_text('untouched')
            site=root/'site.conf';site.write_text('server {\n}\n')
            include=root/'include.conf';include.write_text('existing')
            files={'release.json':json.dumps({'commit':sha}),'deploy/mianjing/nginx.conf':'existing'}
            artifact=incoming/'app.tgz'
            with tarfile.open(artifact,'w:gz') as tar:
                for name,content in files.items():
                    data=content.encode();info=tarfile.TarInfo(name);info.size=len(data);tar.addfile(info,io.BytesIO(data))
            def ready(origin,_sha):
                if origin.startswith('https'):raise RuntimeError('simulated external failure')
            with patch.multiple(deploy,ROOT=root,BACKUPS=root/'backups',SITE=site,INCLUDE=include,SHARED_ENV=shared),patch.object(deploy,'latest'),patch.object(deploy,'processes',return_value={'xuxiao-api':1,'script-hub':2}),patch.object(deploy,'run') as run,patch.object(deploy,'ready',side_effect=ready),patch.object(deploy.shutil,'chown'),patch.object(deploy.time,'sleep'):
                with self.assertRaises(RuntimeError):deploy.deploy(sha,upload,hashlib.sha256(artifact.read_bytes()).hexdigest())
                self.assertEqual((root/'current').resolve(),(root/'releases/previous').resolve())
                commands=[call.args[0] for call in run.call_args_list]
                self.assertIn(['systemctl','restart','mianjing-api.service'],commands)
                self.assertFalse(any('pm2' in str(command) or 'xuxiao-api.service' in command for command in commands))
                self.assertEqual(shared.read_text(),'untouched')


class ReadinessTests(unittest.TestCase):
    def test_reload_window_retries_without_skipping_contract_validation(self):
        from unittest.mock import patch
        import deploy
        with patch.object(deploy,'ready',side_effect=[RuntimeError('404 during reload'),RuntimeError('502 during reload'),None]) as ready,patch.object(deploy.time,'sleep') as sleep:
            deploy.wait_ready('https://example.test','a'*40)
            self.assertEqual(ready.call_count,3)
            self.assertEqual(sleep.call_count,2)

    def test_persistent_failure_still_aborts(self):
        from unittest.mock import patch
        import deploy
        with patch.object(deploy,'ready',side_effect=RuntimeError('wrong commit')) as ready,patch.object(deploy.time,'sleep'):
            with self.assertRaises(RuntimeError):deploy.wait_ready('https://example.test','a'*40,attempts=3)
            self.assertEqual(ready.call_count,3)


class EnvironmentTests(unittest.TestCase):
    def test_dotenv_roundtrip(self):
        import subprocess
        from pathlib import Path
        result=subprocess.run(['node','--test',str(Path(__file__).with_name('env.test.cjs'))],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)
