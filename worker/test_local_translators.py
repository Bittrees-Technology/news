import pathlib
import tempfile
import unittest
from types import SimpleNamespace
from local_translators import LocalTranslators

class TranslatorTests(unittest.TestCase):
    def test_independent_languages_single_resident_and_cache(self):
        with tempfile.TemporaryDirectory() as tmp:
            registry={c:{'folder':c,'sha256':c,'version':'test'} for c in ['fr','de']}
            for c in registry:(pathlib.Path(tmp)/c/'model').mkdir(parents=True)
            loaded=[];unloaded=[]
            def factory(folder):
                loaded.append(folder.name)
                engine=SimpleNamespace(unload_model=lambda:unloaded.append(folder.name),translate_batch=lambda *a,**k:[SimpleNamespace(hypotheses=[['English 2026']])])
                return engine,SimpleNamespace(encode=lambda *a,**k:['input'],decode=lambda x:x[0])
            pool=LocalTranslators(tmp,registry,['fr','de'],factory,cache_size=2)
            self.assertIsNone(pool.translate('Hola','es'))
            self.assertEqual(pool.translate('Bonjour 2026','fr')[0],'English 2026')
            pool.translate('Hallo 2026','de')
            pool.translate('Bonjour 2026','fr')
            self.assertEqual(loaded,['fr','de']);self.assertEqual(unloaded,['fr'])
            self.assertEqual(pool.loaded[0],'de')
            with self.assertRaisesRegex(ValueError,'numbers'):pool.translate('Hallo 2025','de')
            self.assertEqual(len(pool.cache),2)
    def test_numbers_can_move_and_decimal_separator_can_change(self):
        with tempfile.TemporaryDirectory() as tmp:
            (pathlib.Path(tmp)/'de'/'model').mkdir(parents=True)
            registry={'de':{'folder':'de','sha256':'d','version':'test'}}
            output=['Rate could fall by 0.25 in October 2026']
            def factory(folder):
                return SimpleNamespace(translate_batch=lambda *a,**k:[SimpleNamespace(hypotheses=[[output[0]]])]),SimpleNamespace(encode=lambda *a,**k:['input'],decode=lambda x:x[0])
            pool=LocalTranslators(tmp,registry,['de'],factory)
            self.assertEqual(pool.translate('Oktober 2026 um 0,25','de')[0],output[0])
            output[0]='Rate could fall by 0.25 in October 2026 and 2026'
            with self.assertRaisesRegex(ValueError,'numbers'):pool.translate('2026 um 0,25','de')
            self.assertEqual(len(pool.cache),1)

    def test_truncation_not_cached_and_disabled_package_not_loaded(self):
        with tempfile.TemporaryDirectory() as tmp:
            (pathlib.Path(tmp)/'fr'/'model').mkdir(parents=True)
            registry={'fr':{'folder':'fr','sha256':'f','version':'test'}}
            def factory(folder):
                return SimpleNamespace(translate_batch=lambda *a,**k:[SimpleNamespace(hypotheses=[['x']*512])]),SimpleNamespace(encode=lambda *a,**k:['input'])
            pool=LocalTranslators(tmp,registry,[],factory)
            self.assertIsNone(pool.translate('Bonjour','fr'))
            pool.enabled.add('fr')
            with self.assertRaisesRegex(ValueError,'Truncated'):pool.translate('Bonjour','fr')
            self.assertFalse(pool.cache)

if __name__=='__main__':unittest.main()
