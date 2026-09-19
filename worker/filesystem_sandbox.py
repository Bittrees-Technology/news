"""Fail-closed Linux Landlock filesystem allowlist, without root privileges."""
import ctypes,os,pathlib

def restrict_files(readonly,writable):
    libc=ctypes.CDLL(None,use_errno=True)
    abi=libc.syscall(444,0,0,1)
    if abi<3:raise RuntimeError('Landlock ABI 3 required')
    handled=(1<<15)-1
    read=(1<<0)|(1<<2)|(1<<3) # execute, read file, read directory
    class Ruleset(ctypes.Structure):_fields_=[('handled_access_fs',ctypes.c_uint64)]
    class PathRule(ctypes.Structure):
        _pack_=1
        _fields_=[('allowed_access',ctypes.c_uint64),('parent_fd',ctypes.c_int)]
    attr=Ruleset(handled)
    fd=libc.syscall(444,ctypes.byref(attr),ctypes.sizeof(attr),0)
    if fd<0:raise OSError(ctypes.get_errno(),'Landlock ruleset')
    try:
        for path,access in [(p,read) for p in readonly]+[(p,handled) for p in writable]:
            path=pathlib.Path(path)
            if not path.exists():continue
            parent=os.open(path,os.O_PATH|os.O_CLOEXEC)
            try:
                if not path.is_dir():access &= (1<<0)|(1<<1)|(1<<2)|(1<<14)
                rule=PathRule(access,parent)
                if libc.syscall(445,fd,1,ctypes.byref(rule),0)<0:raise OSError(ctypes.get_errno(),'Landlock path rule')
            finally:os.close(parent)
        if libc.prctl(38,1,0,0,0)!=0:raise OSError(ctypes.get_errno(),'No-new-privileges')
        if libc.syscall(446,fd,0)<0:raise OSError(ctypes.get_errno(),'Landlock restriction')
    finally:os.close(fd)
