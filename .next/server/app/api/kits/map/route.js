"use strict";(()=>{var e={};e.id=6669,e.ids=[6669],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},10725:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>c,patchFetch:()=>l,requestAsyncStorage:()=>d,routeModule:()=>m,serverHooks:()=>S,staticGenerationAsyncStorage:()=>R});var i={};a.r(i),a.d(i,{GET:()=>E,dynamic:()=>p});var r=a(87916),u=a(49930),s=a(2169),n=a(4389),o=a(27191);let p="force-dynamic";async function E(e){try{let{searchParams:t}=new URL(e.url),a=(t.get("q")||"").trim(),i=(t.get("unidade")||"").trim(),r=Math.max(1,Number(t.get("page")||"1")),u=Math.min(500,Math.max(10,Number(t.get("size")||"100"))),s=[],p=[];if(a){let e=`%${a.toUpperCase()}%`;p.push(e),s.push(`(UPPER(m.alterdata_funcao) LIKE $${p.length} OR UPPER(m.epi_item) LIKE $${p.length})`)}i&&(p.push(`%${i.toUpperCase()}%`),s.push(`(
        UPPER(TRIM(COALESCE(m.unidade_hospitalar, ''))) LIKE $${p.length}
        OR (m.pcg = 'PCG UNIVERSAL' AND 'PCG UNIVERSAL' LIKE $${p.length})
      )`));let E=s.length?`WHERE ${s.join(" AND ")}`:"",m=`COALESCE(
      CASE WHEN m.pcg = 'PCG UNIVERSAL' AND (m.unidade_hospitalar IS NULL OR TRIM(COALESCE(m.unidade_hospitalar, '')) = '')
        THEN 'PCG UNIVERSAL'
        ELSE NULLIF(TRIM(COALESCE(m.unidade_hospitalar, '')), '')
      END,
      '—'
    )`,d="TRIM(COALESCE(m.funcao_normalizada, m.alterdata_funcao, ''))",R=await o.Z.$queryRawUnsafe(`
      SELECT sub.funcao, sub.item, MAX(sub.quantidade)::int AS quantidade, sub.unidade
      FROM (
        SELECT
          ${d} AS funcao,
          TRIM(COALESCE(m.epi_item, '')) AS item,
          GREATEST(1, ROUND(COALESCE(NULLIF(TRIM(m.quantidade::text), '')::numeric, 1)))::int AS quantidade,
          ${m} AS unidade
        FROM stg_epi_map m
        ${E}
      ) sub
      WHERE sub.funcao != '' AND sub.item != '' AND UPPER(sub.item) != 'SEM EPI'
      GROUP BY sub.funcao, sub.item, sub.unidade
      ORDER BY sub.funcao, sub.item
      LIMIT ${u} OFFSET ${(r-1)*u}
      `,...p),S=await o.Z.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM (
        SELECT 1
        FROM (
          SELECT ${d} AS funcao, TRIM(COALESCE(m.epi_item, '')) AS item, ${m} AS unidade
          FROM stg_epi_map m
          ${E}
        ) sub
        WHERE sub.funcao != '' AND sub.item != '' AND UPPER(sub.item) != 'SEM EPI'
        GROUP BY sub.funcao, sub.item, sub.unidade
      ) g
      `,...p),c=S?.[0]?.c??R.length;return n.NextResponse.json({rows:R,total:c})}catch(e){return console.error("Error in /api/kits/map",e),n.NextResponse.json({error:e?.message||"Erro ao carregar mapa de kits."},{status:500})}}let m=new r.AppRouteRouteModule({definition:{kind:u.x.APP_ROUTE,page:"/api/kits/map/route",pathname:"/api/kits/map",filename:"route",bundlePath:"app/api/kits/map/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/kits/map/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:d,staticGenerationAsyncStorage:R,serverHooks:S}=m,c="/api/kits/map/route";function l(){return(0,s.patchFetch)({serverHooks:S,staticGenerationAsyncStorage:R})}},27191:(e,t,a)=>{a.d(t,{Z:()=>r});var i=a(53524);let r=globalThis.prisma??new i.PrismaClient({log:["error"]})},87916:(e,t,a)=>{e.exports=a(30517)}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[2035,4389],()=>a(10725));module.exports=i})();