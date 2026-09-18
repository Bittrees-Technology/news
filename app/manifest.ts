import type {MetadataRoute} from 'next';
export default function manifest():MetadataRoute.Manifest{return {name:'The Bittrees News',short_name:'TBN',start_url:'/',display:'browser',background_color:'#142630',theme_color:'#142630',icons:[{src:'/brand/tbn-192.png',sizes:'192x192',type:'image/png'},{src:'/brand/tbn-512.png',sizes:'512x512',type:'image/png'}]};}
