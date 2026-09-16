import type {Metadata} from 'next';import {Header,Footer} from '@/components/client';import './globals.css';
export const metadata:Metadata={title:'Bittrees News — World, economy, technology & science',description:'A source-linked newspaper from Bittrees. Read the latest edition freely, or personalize your sources and deliveries.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body><div className="site"><Header/><main>{children}</main><Footer/></div></body></html>;}
