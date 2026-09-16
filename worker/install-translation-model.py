#!/usr/bin/env python3
"""Install the official Argos Portuguese-English model for the public-news worker."""
import pathlib,sys,zipfile,hashlib
archive=pathlib.Path(sys.argv[1])
if hashlib.sha256(archive.read_bytes()).hexdigest()!='ae76df6f650895c16f2b582065014fab496755ca846ecb19fae81d51f332a38e':raise ValueError('Unexpected model archive checksum')
root=pathlib.Path.home()/'.local/state/bittrees-news/models'
root.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(archive) as package:
    for member in package.infolist():
        destination=(root/member.filename).resolve()
        if not destination.is_relative_to(root.resolve()):raise ValueError('Invalid model archive path')
    package.extractall(root)
print('Installed model archive SHA256:',hashlib.sha256(archive.read_bytes()).hexdigest())
print('Models:',[p.name for p in root.iterdir()])
