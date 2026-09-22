import hashlib
import importlib.util
import json
import pathlib
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('installer', pathlib.Path(__file__).with_name('install-translation-package.py'))
installer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(installer)

class InstallTests(unittest.TestCase):
    def test_verified_atomic_install_does_not_enable_or_overwrite(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            archive = root/'test.zip'
            with zipfile.ZipFile(archive, 'w') as package:
                package.writestr('fr/metadata.json', json.dumps({'from_code':'fr','to_code':'en','package_version':'1'}))
                package.writestr('fr/model/data', b'model')
                package.writestr('fr/sentencepiece.model', b'tokenizer')
            model = {'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'folder':'fr', 'version':'1'}
            installer.install(archive, root/'models', model, 'fr')
            self.assertTrue((root/'models/fr/model/data').is_file())
            self.assertFalse((root/'translation-enabled.json').exists())
            with self.assertRaisesRegex(ValueError, 'already exists'):
                installer.install(archive, root/'models', model, 'fr')

    def test_checksum_and_traversal_rejected(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            archive = root/'test.zip'
            with zipfile.ZipFile(archive, 'w') as package:
                package.writestr('../escaped', b'bad')
            model = {'sha256':'incorrect','folder':'fr','version':'1'}
            with self.assertRaisesRegex(ValueError, 'checksum'):
                installer.install(archive, root/'models', model, 'fr')
            model['sha256'] = hashlib.sha256(archive.read_bytes()).hexdigest()
            with self.assertRaisesRegex(ValueError, 'archive path'):
                installer.install(archive, root/'models', model, 'fr')
            self.assertFalse((root/'escaped').exists())
            self.assertFalse((root/'models/fr').exists())

if __name__ == '__main__': unittest.main()
