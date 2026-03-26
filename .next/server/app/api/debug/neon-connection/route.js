"use strict";(()=>{var e={};e.id=1808,e.ids=[1808],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},98266:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>g,patchFetch:()=>E,requestAsyncStorage:()=>m,routeModule:()=>l,serverHooks:()=>_,staticGenerationAsyncStorage:()=>d});var n={};a.r(n),a.d(n,{GET:()=>p,dynamic:()=>u});var o=a(87916),r=a(49930),s=a(2169),i=a(4389),c=a(27191);let u="force-dynamic";async function p(){try{let e=await c.Z.$queryRawUnsafe("SELECT 1 as test"),t=await c.Z.$queryRawUnsafe(`
      SELECT 
        table_name,
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `),a={};for(let e of["stg_epi_map","stg_alterdata_v2","stg_unid_reg","epi_entregas"])try{let t=await c.Z.$queryRawUnsafe(`SELECT COUNT(*) as total FROM ${e}`);a[e]=Number(t[0]?.total||0)}catch(t){a[e]=-1}let n=null;if(a.stg_epi_map>=0)try{n=await c.Z.$queryRawUnsafe(`
          SELECT 
            column_name,
            data_type,
            is_nullable
          FROM information_schema.columns
          WHERE table_name = 'stg_epi_map'
          ORDER BY ordinal_position
        `)}catch(e){}let o=[];if(a.stg_epi_map>0)try{o=await c.Z.$queryRawUnsafe(`
          SELECT * FROM stg_epi_map LIMIT 5
        `)}catch(e){}return i.NextResponse.json({ok:!0,connected:!0,connectionTest:e[0]?.test===1,allTables:t,tableCounts:a,epiMapStructure:n,epiMapSamples:o,message:"Conex\xe3o com Neon funcionando!"})}catch(e){return i.NextResponse.json({ok:!1,connected:!1,error:String(e?.message||e),message:"Erro ao conectar com Neon. Verifique a DATABASE_URL no .env"},{status:500})}}let l=new o.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/debug/neon-connection/route",pathname:"/api/debug/neon-connection",filename:"route",bundlePath:"app/api/debug/neon-connection/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/debug/neon-connection/route.ts",nextConfigOutput:"",userland:n}),{requestAsyncStorage:m,staticGenerationAsyncStorage:d,serverHooks:_}=l,g="/api/debug/neon-connection/route";function E(){return(0,s.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:d})}},27191:(e,t,a)=>{a.d(t,{Z:()=>o});var n=a(53524);let o=globalThis.prisma??new n.PrismaClient({log:["error"]})},87916:(e,t,a)=>{e.exports=a(30517)}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),n=t.X(0,[2035,4389],()=>a(98266));module.exports=n})();