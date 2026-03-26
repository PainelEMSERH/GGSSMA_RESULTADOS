"use strict";(()=>{var e={};e.id=1539,e.ids=[1539,5892],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},10235:(e,r,a)=>{a.r(r),a.d(r,{originalPathname:()=>m,patchFetch:()=>E,requestAsyncStorage:()=>c,routeModule:()=>l,serverHooks:()=>g,staticGenerationAsyncStorage:()=>d});var i={};a.r(i),a.d(i,{GET:()=>u});var n=a(87916),o=a(49930),t=a(2169),s=a(4389),p=a(65892);async function u(){try{let e=await p.prisma.$queryRawUnsafe(`
      SELECT EXISTS (
        SELECT 1 FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r','v','m') AND n.nspname = 'public' AND c.relname = 'cronograma_cipa'
      ) AS exists
    `);if(!e?.[0]?.exists)return s.NextResponse.json({ok:!0,regionais:[],unidades:[]});let r=(await p.prisma.$queryRawUnsafe(`
      SELECT DISTINCT UPPER(COALESCE(TRIM(regional), '')) AS regional
      FROM cronograma_cipa
      WHERE COALESCE(TRIM(regional), '') != ''
      ORDER BY regional
    `)).map(e=>String(e?.regional??"").trim()).filter(Boolean),a=(await p.prisma.$queryRawUnsafe(`
      SELECT DISTINCT UPPER(COALESCE(TRIM(regional), '')) AS regional, COALESCE(TRIM(unidade), '') AS unidade
      FROM cronograma_cipa
      WHERE COALESCE(TRIM(unidade), '') != ''
      ORDER BY regional, unidade
    `)).map(e=>({regional:String(e?.regional??"").trim(),unidade:String(e?.unidade??"").trim()})).filter(e=>e.unidade);return s.NextResponse.json({ok:!0,regionais:r,unidades:a})}catch(e){return console.error("[cipa/options] error",e),s.NextResponse.json({ok:!1,error:String(e?.message??e)},{status:500})}}let l=new n.AppRouteRouteModule({definition:{kind:o.x.APP_ROUTE,page:"/api/cipa/options/route",pathname:"/api/cipa/options",filename:"route",bundlePath:"app/api/cipa/options/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/cipa/options/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:c,staticGenerationAsyncStorage:d,serverHooks:g}=l,m="/api/cipa/options/route";function E(){return(0,t.patchFetch)({serverHooks:g,staticGenerationAsyncStorage:d})}},65892:(e,r,a)=>{a.d(r,{prisma:()=>n});var i=a(53524);let n=globalThis.prisma??new i.PrismaClient({log:["error","warn"]})},87916:(e,r,a)=>{e.exports=a(30517)}};var r=require("../../../../webpack-runtime.js");r.C(e);var a=e=>r(r.s=e),i=r.X(0,[2035,4389],()=>a(10235));module.exports=i})();