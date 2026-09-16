import {pool,schema} from '../lib/db';await pool().query(schema);console.log('News schema ready');await pool().end();
