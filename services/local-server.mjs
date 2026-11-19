import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createMemoryRepositories } from './shared/memory.mjs';
import { createCatalogHandler } from './catalog/index.mjs';
import { createQuotingHandler } from './quoting/index.mjs';
import { syntheticCatalog } from './fixtures/catalog.mjs';
import { handler as health } from './health/index.mjs';

export async function createDemoServer() {
  if(process.env.AWS_LAMBDA_FUNCTION_NAME) throw new Error('The synthetic demo server cannot run in AWS Lambda.');
  const repositories=createMemoryRepositories();
  await repositories.catalog.publish('demo',syntheticCatalog);
  const catalog=createCatalogHandler({repository:repositories.catalog});
  const quoting=createQuotingHandler({repository:repositories.quotes,readCatalog:(org,id,version)=>repositories.catalog.get(org,id,version)});
  return createServer(async(req,res)=>{
    // The demo has no authentication and therefore serves loopback clients only.
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {res.writeHead(403);res.end();return;}
    const origin=req.headers.origin;
    if(origin && !/^http:\/\/(localhost|127\.0\.0\.1):(4200|4300|3001)$/.test(origin)) {res.writeHead(403);res.end();return;}
    if(origin) {res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');}
    if(req.method==='OPTIONS') {
      res.writeHead(204,{'access-control-allow-methods':'GET,POST,OPTIONS','access-control-allow-headers':'Content-Type,Idempotency-Key,Authorization'});res.end();return;
    }
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path==='/config.json' && req.method==='GET') {
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      res.end(JSON.stringify({productName:'CotiTrama',apiBaseUrl:'/api/v1',demo:true}));return;
    }
    let body='';
    try {
      for await(const chunk of req) {body+=chunk.toString();if(Buffer.byteLength(body)>200_000){res.writeHead(413);res.end();return;}}
      const event={version:'2.0',rawPath:path,headers:req.headers,body:body||undefined,requestContext:{requestId:randomUUID(),http:{method:req.method},authorizer:{jwt:{claims:{sub:'synthetic-demo-operator',token_use:'access','cognito:groups':['org:demo:admin']}}}}};
      const response=path==='/health' || path==='/api/health' ? await health(event) : path.startsWith('/api/v1/catalogs') ? await catalog(event) : await quoting(event);
      res.writeHead(response.statusCode,response.headers);res.end(response.body);
    } catch {
      res.writeHead(500,{'content-type':'application/json'});res.end(JSON.stringify({error:{code:'DEMO_ERROR',message:'No se pudo completar la operación de prueba.'}}));
    }
  });
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href) {
  const port=Number(process.env.PORT ?? 4300);
  if(!Number.isInteger(port) || port<1 || port>65535) throw new Error('Invalid local port');
  const server=await createDemoServer();
  server.listen(port,'127.0.0.1',()=>console.log(`CotiTrama demo API: http://127.0.0.1:${port}`));
}
