import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createMemoryRepositories } from './shared/memory.mjs';
import { createCatalogHandler } from './catalog/index.mjs';
import { createQuotingHandler } from './quoting/index.mjs';
import { syntheticCatalog } from './fixtures/catalog.mjs';
import { handler as health } from './health/index.mjs';
import { createTeamHandler } from './team/index.mjs';
import { createMemoryTeamRepository } from './team/memory.mjs';
import { accessSubject } from './shared/auth.mjs';
import { HttpError } from './shared/errors.mjs';

export async function createDemoServer() {
  if(process.env.AWS_LAMBDA_FUNCTION_NAME) throw new Error('The synthetic demo server cannot run in AWS Lambda.');
  const repositories=createMemoryRepositories();
  await repositories.catalog.publish('demo',syntheticCatalog);
  const demoSubject='00000000-0000-4000-8000-000000000001';
  const members=createMemoryTeamRepository();
  await members.initialize(demoSubject,'demo@example.invalid',[{subject:demoSubject,organizationId:'demo',role:'admin',email:'demo@example.invalid',joinedAt:new Date().toISOString()}]);
  const team=createTeamHandler({repository:members,users:{get:async subject=>subject===demoSubject ? {subject,email:'demo@example.invalid',emailVerified:true} : undefined,groups:async()=>[]}});
  const authorize=async event=>{
    const selected=Object.entries(event.headers ?? {}).find(([name])=>name.toLowerCase()==='x-organization-id')?.[1];
    const result=await team({operation:'authorizeMembership',subject:accessSubject(event),...(selected ? {organizationId:selected} : {})});
    if(result.error) throw new HttpError(result.error.statusCode,result.error.code,result.error.message);return result;
  };
  const catalog=createCatalogHandler({repository:repositories.catalog,authorize});
  const quoting=createQuotingHandler({repository:repositories.quotes,readCatalog:(org,id,version)=>repositories.catalog.getPublished(org,id,version),authorize});
  return createServer(async(req,res)=>{
    // The demo has no authentication and therefore serves loopback clients only.
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) {res.writeHead(403);res.end();return;}
    const origin=req.headers.origin;
    if(origin && !/^http:\/\/(localhost|127\.0\.0\.1):(4200|4300|3001)$/.test(origin)) {res.writeHead(403);res.end();return;}
    if(origin) {res.setHeader('access-control-allow-origin',origin);res.setHeader('vary','Origin');}
    if(req.method==='OPTIONS') {
      res.writeHead(204,{'access-control-allow-methods':'GET,POST,PATCH,DELETE,OPTIONS','access-control-allow-headers':'Content-Type,Idempotency-Key,Authorization,X-Organization-Id'});res.end();return;
    }
    const path=new URL(req.url,'http://127.0.0.1').pathname;
    if(path==='/config.json' && req.method==='GET') {
      res.writeHead(200,{'content-type':'application/json; charset=utf-8','cache-control':'no-store'});
      res.end(JSON.stringify({productName:'CotiTrama',apiBaseUrl:'/api/v1',demo:true}));return;
    }
    let body='';
    try {
      for await(const chunk of req) {body+=chunk.toString();if(Buffer.byteLength(body)>200_000){res.writeHead(413);res.end();return;}}
      const event={version:'2.0',rawPath:path,headers:req.headers,body:body||undefined,requestContext:{requestId:randomUUID(),http:{method:req.method},authorizer:{jwt:{claims:{sub:demoSubject,token_use:'access','cognito:groups':['org:demo:admin']}}}}};
      const response=path==='/health' || path==='/api/health' ? await health(event) : path.startsWith('/api/v1/team') ? await team(event) : path.startsWith('/api/v1/catalogs') ? await catalog(event) : await quoting(event);
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
