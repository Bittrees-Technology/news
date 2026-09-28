import type { Metadata } from "next";
export const siteUrl = "https://news.bittrees.org";
export const siteName = "The Bittrees News";
export const siteDescription = "Global news, economics, technology and science. Read source-linked briefings, discover podcasts and data, and curate your own free newspaper.";
export function pageMetadata(title:string, description:string, path:string): Metadata {
  const url = new URL(path, siteUrl).href;
  const shareTitle = title.replaceAll(siteName, "TBN");
  return {title:shareTitle, description, alternates:{canonical:url},openGraph:{type:"website",siteName:"TBN",title:shareTitle,description,url,locale:"en_GB",images:[{url:siteUrl+"/brand/social-v4.png",width:1200,height:630,alt:"TBN — World, economy, technology and science"}]},twitter:{card:"summary_large_image",title:shareTitle,description,images:[{url:siteUrl+"/brand/social-v4.png",alt:"TBN — Global news, podcasts and data"}]}};
}
export const privateMetadata: Metadata = { title:"Your account",robots:{index:false,follow:false},openGraph:{title:"TBN",description:"Sign in to manage your newspaper."}};
