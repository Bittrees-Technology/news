import {prepare,publish} from '../lib/publish';import {pool} from '../lib/db';try{console.log(await prepare());console.log(await publish());}finally{await pool().end();}
