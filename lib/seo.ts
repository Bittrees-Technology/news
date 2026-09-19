import type { Metadata } from "next";
export const siteUrl = "https://news.bittrees.org";
export const siteName = "The Bittrees News";
export const siteDescription = "World news, economics, technology and science in a free, source-linked newspaper. Three daily editions, with personal newspapers and email digests.";
export function pageMetadata(title:string, description:string, path:string): Metadata {
  const url = new URL(path, siteUrl).href;
  const shareTitle = title.replaceAll(siteName, "TBN");
  return {title, description, alternates:{canonical:url},openGraph:{type:"website",siteName:"TBN",title:shareTitle,description,url,locale:"en_GB",images:[{url:siteUrl+"/brand/social-v3.png",width:1200,height:630,alt:"TBN — World, economy, technology and science"}]},twitter:{card:"summary_large_image",title:shareTitle,description,images:[siteUrl+"/brand/social-v3.png"]}};
}
export const privateMetadata: Metadata = { title:"Your account",robots:{index:false,follow:false},openGraph:{title:"TBN",description:"Sign in to manage your newspaper."}};
