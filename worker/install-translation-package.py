#!/usr/bin/env python3
"""Install a checksum-pinned language package without enabling it."""
import argparse
import hashlib
import json
import pathlib
import stat
import tempfile
import zipfile


def install(archive, root, model, language):
    archive, root = pathlib.Path(archive), pathlib.Path(root)
    with archive.open('rb') as handle:
        checksum = hashlib.sha256()
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            checksum.update(chunk)
        digest = checksum.hexdigest()
    if digest != model['sha256']:
        raise ValueError('Unexpected model archive checksum')
    root.mkdir(parents=True, exist_ok=True)
    target = root / model['folder']
    if target.exists():
        raise ValueError('Model directory already exists; verify it rather than overwriting')
    with tempfile.TemporaryDirectory(dir=root, prefix='.translation-install-') as temp:
        staging = pathlib.Path(temp)
        with zipfile.ZipFile(archive) as package:
            if sum(m.file_size for m in package.infolist()) > 1024**3:
                raise ValueError('Model archive too large')
            for member in package.infolist():
                destination = (staging / member.filename).resolve()
                if not destination.is_relative_to(staging.resolve()) or stat.S_ISLNK(member.external_attr >> 16):
                    raise ValueError('Invalid model archive path')
            package.extractall(staging)
        folders = list(staging.glob('*/metadata.json'))
        if len(folders) != 1:
            raise ValueError('Ambiguous package metadata')
        metadata = json.loads(folders[0].read_text())
        if metadata.get('from_code') != language or metadata.get('to_code') != 'en' or metadata.get('package_version') != model['version']:
            raise ValueError('Unexpected language pair or package version')
        source = folders[0].parent
        if not (source/'model').is_dir() or not any((source/name).is_file() for name in ['sentencepiece.model', 'bpe.model']):
            raise ValueError('Missing translation model or tokenizer')
        source.rename(target)
    print(json.dumps({'installed': language, 'folder': target.name, 'sha256': digest, 'enabled': False}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('language')
    parser.add_argument('archive')
    parser.add_argument('--root', default=str(pathlib.Path.home()/'.local/state/bittrees-news/models'))
    args = parser.parse_args()
    registry = json.loads(pathlib.Path(__file__).with_name('translation-models.json').read_text())
    install(args.archive, args.root, registry[args.language], args.language)
