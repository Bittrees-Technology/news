"""Bounded, independently enabled local English translation packages."""
import collections
from decimal import Decimal, InvalidOperation
import gc
import json
import pathlib
import re


class BPETokenizer:
    def __init__(self, folder):
        from sacremoses import MosesTokenizer, MosesDetokenizer, MosesPunctNormalizer
        from subword_nmt.apply_bpe import BPE
        metadata = json.loads((folder / 'metadata.json').read_text())
        self.tokenizer = MosesTokenizer(metadata['from_code'])
        self.detokenizer = MosesDetokenizer(metadata['to_code'])
        self.normalizer = MosesPunctNormalizer(metadata['from_code'])
        with (folder / 'bpe.model').open(encoding='utf-8') as handle:
            self.bpe = BPE(handle)

    def encode(self, text, out_type=str):
        tokens = self.tokenizer.tokenize(self.normalizer.normalize(text))
        # The BPE library caches word segmentations; bound it independently too.
        if len(self.bpe.cache) > 4096:
            self.bpe.cache.clear()
        return self.bpe.segment_tokens(tokens)

    def decode(self, tokens):
        return self.detokenizer.detokenize(' '.join(tokens).replace('@@ ', '').split(' '))


def _engine(folder):
    import ctranslate2
    import sentencepiece
    tokenizer = (sentencepiece.SentencePieceProcessor(model_file=str(folder / 'sentencepiece.model'))
                 if (folder / 'sentencepiece.model').exists() else BPETokenizer(folder))
    return (ctranslate2.Translator(str(folder / 'model'), device='cpu', compute_type='int8', intra_threads=2, inter_threads=1),
            tokenizer)


class LocalTranslators:
    def __init__(self, root, registry=None, enabled=None, factory=_engine, cache_size=256):
        self.root = pathlib.Path(root)
        self.registry = registry if registry is not None else json.loads(pathlib.Path(__file__).with_name('translation-models.json').read_text())
        # Installed is not enabled: new languages require a reviewed local allowlist.
        self.enabled = set(enabled if enabled is not None else ['pt'])
        self.factory = factory
        self.loaded = None
        self.cache = collections.OrderedDict()
        self.cache_size = cache_size

    def translate(self, text, language):
        if language not in self.enabled or language not in self.registry:
            return None
        model = self.registry[language]
        key = (language, model['sha256'], text)
        if key in self.cache:
            self.cache.move_to_end(key)
            return self.cache[key]
        folder = self.root / model['folder']
        if not (folder / 'model').is_dir():
            return None
        if self.loaded is None or self.loaded[0] != language:
            if self.loaded is not None:
                self.loaded[1].unload_model()
                self.loaded = None
                gc.collect()
            engine, tokenizer = self.factory(folder)
            self.loaded = (language, engine, tokenizer)
        _, engine, tokenizer = self.loaded
        tokens = tokenizer.encode(text, out_type=str)
        # No silent truncation of long source text; let the existing fallback handle it.
        if len(tokens) > 450:
            raise ValueError('Local translation input exceeds bounded window')
        result = engine.translate_batch([tokens], beam_size=4, max_decoding_length=512)[0]
        output = result.hypotheses[0]
        if len(output) >= 512:
            raise ValueError('Truncated local translation')
        value = tokenizer.decode(output).replace('▁', ' ').strip()
        if not value or len(value) > 1800:
            raise ValueError('Invalid local translation size')
        # Word order can legitimately move dates and quantities. Preserve the
        # multiset of numeric values, allowing a localized decimal separator.
        def numbers(s):
            found=[]
            for token in re.findall(r'\d+(?:[.,]\d+)*', s):
                try:found.append(str(Decimal(token.replace(',', '.')).normalize()))
                except InvalidOperation:found.append(token)
            return collections.Counter(found)
        if numbers(text) != numbers(value):
            raise ValueError('Local translation changed numbers')
        translated = (value, 'Bittrees-hosted Argos ' + language + '-en ' + model['version'])
        self.cache[key] = translated
        while len(self.cache) > self.cache_size:
            self.cache.popitem(last=False)
        return translated
