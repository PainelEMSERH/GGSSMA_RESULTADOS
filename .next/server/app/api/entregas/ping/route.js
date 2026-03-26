"use strict";(()=>{var e={};e.id=9547,e.ids=[9547,5892],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},65816:(e,t,r)=>{r.r(t),r.d(t,{originalPathname:()=>l,patchFetch:()=>x,requestAsyncStorage:()=>d,routeModule:()=>g,serverHooks:()=>T,staticGenerationAsyncStorage:()=>m});var a={};r.r(a),r.d(a,{GET:()=>u});var n=r(87916),i=r(49930),s=r(2169),p=r(4389),o=r(65892);async function u(){try{await o.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega_epi (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        cpf text NOT NULL,
        nome text NOT NULL,
        funcao text,
        regional text,
        unidade text,
        item text NOT NULL,
        quantidade int NOT NULL,
        data_entrega timestamptz NOT NULL DEFAULT now(),
        entregue_por text,
        obs text
      );
    `);let e=await o.prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*)::int FROM stg_alterdata) AS stg_alterdata,
        (SELECT COUNT(*)::int FROM stg_unid_reg) AS stg_unid_reg,
        (SELECT COUNT(*)::int FROM stg_epi_map) AS stg_epi_map,
        (SELECT COUNT(*)::int FROM entrega_epi) AS entrega_epi
    `);return p.NextResponse.json({ok:!0,counts:e?.[0]||{}})}catch(e){return p.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let g=new n.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/entregas/ping/route",pathname:"/api/entregas/ping",filename:"route",bundlePath:"app/api/entregas/ping/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/entregas/ping/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:d,staticGenerationAsyncStorage:m,serverHooks:T}=g,l="/api/entregas/ping/route";function x(){return(0,s.patchFetch)({serverHooks:T,staticGenerationAsyncStorage:m})}},65892:(e,t,r)=>{r.d(t,{prisma:()=>n});var a=r(53524);let n=globalThis.prisma??new a.PrismaClient({log:["error","warn"]})},87916:(e,t,r)=>{e.exports=r(30517)}};var t=require("../../../../webpack-runtime.js");t.C(e);var r=e=>t(t.s=e),a=t.X(0,[2035,4389],()=>r(65816));module.exports=a})();