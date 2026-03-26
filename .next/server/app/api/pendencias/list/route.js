"use strict";(()=>{var e={};e.id=6551,e.ids=[6551],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},19691:(e,t,a)=>{a.r(t),a.d(t,{originalPathname:()=>E,patchFetch:()=>g,requestAsyncStorage:()=>l,routeModule:()=>c,serverHooks:()=>h,staticGenerationAsyncStorage:()=>m});var i={};a.r(i),a.d(i,{GET:()=>u,dynamic:()=>d});var r=a(87916),n=a(49930),o=a(2169),p=a(4389),s=a(27191);let d="force-dynamic";async function u(e){let{searchParams:t}=new URL(e.url),a=(t.get("status")||"").trim(),i=(t.get("q")||"").trim(),r=Math.max(1,Number(t.get("page")||"1")),n=Math.min(100,Math.max(10,Number(t.get("size")||"25"))),o=[],d=[];if(a&&(d.push(a),o.push(`p.status = $${d.length}`)),i){let e=`%${i.toUpperCase()}%`;d.push(e),o.push(`(UPPER(c.nome) LIKE $${d.length} OR UPPER(i.nome) LIKE $${d.length})`)}let u=o.length?`WHERE ${o.join(" AND ")}`:"",c=await s.Z.$queryRawUnsafe(`
    SELECT p.id, p.quantidade, p.status, p.abertaEm, p.prazo, p.atendidaEm,
           c.id AS "colaboradorId", c.nome AS colaborador,
           i.id AS "itemId", i.nome AS item
    FROM pendencia p
    JOIN colaborador c ON c.id = p."colaboradorId"
    JOIN item        i ON i.id = p."itemId"
    ${u}
    ORDER BY p.abertaEm DESC
    LIMIT ${n} OFFSET ${(r-1)*n}
  `,...d),l=await s.Z.$queryRawUnsafe(`
    SELECT COUNT(*)::int AS c
    FROM pendencia p
    JOIN colaborador c ON c.id = p."colaboradorId"
    JOIN item        i ON i.id = p."itemId"
    ${u}
  `,...d);return p.NextResponse.json({total:l?.[0]?.c??0,rows:c})}let c=new r.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/pendencias/list/route",pathname:"/api/pendencias/list",filename:"route",bundlePath:"app/api/pendencias/list/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/pendencias/list/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:l,staticGenerationAsyncStorage:m,serverHooks:h}=c,E="/api/pendencias/list/route";function g(){return(0,o.patchFetch)({serverHooks:h,staticGenerationAsyncStorage:m})}},27191:(e,t,a)=>{a.d(t,{Z:()=>r});var i=a(53524);let r=globalThis.prisma??new i.PrismaClient({log:["error"]})},87916:(e,t,a)=>{e.exports=a(30517)}};var t=require("../../../../webpack-runtime.js");t.C(e);var a=e=>t(t.s=e),i=t.X(0,[2035,4389],()=>a(19691));module.exports=i})();