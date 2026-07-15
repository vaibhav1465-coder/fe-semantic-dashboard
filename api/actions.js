import { listActions, saveAction, persistenceMode } from "../lib/storage.js";
function readBody(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve,reject)=>{
    let raw="";
    req.on("data",chunk=>raw+=chunk);
    req.on("end",()=>{try{resolve(raw?JSON.parse(raw):{});}catch(error){reject(error);}});
    req.on("error",reject);
  });
}
export default async function handler(req,res) {
  try {
    if (req.method === "GET") return res.status(200).json({items:await listActions(),persistence:persistenceMode()});
    if (req.method === "POST") {
      const item = await saveAction(await readBody(req));
      return res.status(200).json({item,persistence:persistenceMode()});
    }
    return res.status(405).json({error:"Method not allowed"});
  } catch (error) {
    return res.status(400).json({error:error.message,persistence:persistenceMode()});
  }
}
