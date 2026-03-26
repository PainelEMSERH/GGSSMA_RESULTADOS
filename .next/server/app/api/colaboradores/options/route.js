"use strict";(()=>{var e={};e.id=2859,e.ids=[2859],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},41972:(e,o,r)=>{r.r(o),r.d(o,{originalPathname:()=>E,patchFetch:()=>g,requestAsyncStorage:()=>d,routeModule:()=>c,serverHooks:()=>m,staticGenerationAsyncStorage:()=>R});var a={};r.r(a),r.d(a,{GET:()=>l,dynamic:()=>u,revalidate:()=>p,runtime:()=>i});var n=r(87916),t=r(49930),s=r(2169);let i="nodejs",u="force-dynamic",p=0;async function l(){let{prisma:e}=await r.e(5892).then(r.bind(r,65892));try{let o=!1;try{let r=await e.$queryRaw`SELECT COUNT(*)::int c FROM regional`;o=Number(r?.[0]?.c||0)>0}catch{o=!1}if(o){let[o,r]=await Promise.all([e.$queryRaw`SELECT id, nome FROM regional ORDER BY nome`,e.$queryRaw`SELECT id, nome FROM funcao ORDER BY nome`]);return Response.json({ok:!0,regionais:o,funcoes:r})}let r=await e.$queryRawUnsafe(`
      SELECT md5(regional_responsavel) AS id, regional_responsavel AS nome
      FROM stg_unid_reg
      WHERE regional_responsavel IS NOT NULL AND regional_responsavel <> ''
      GROUP BY regional_responsavel
      ORDER BY regional_responsavel
    `),a=await e.$queryRawUnsafe(`
      SELECT md5(funcao) AS id, funcao AS nome
      FROM stg_alterdata
      WHERE funcao IS NOT NULL AND funcao <> ''
      GROUP BY funcao
      ORDER BY funcao
    `);return Response.json({ok:!0,regionais:r,funcoes:a})}catch(e){return console.error("[colaboradores/options] error",e),Response.json({ok:!1,regionais:[],funcoes:[]})}}let c=new n.AppRouteRouteModule({definition:{kind:t.x.APP_ROUTE,page:"/api/colaboradores/options/route",pathname:"/api/colaboradores/options",filename:"route",bundlePath:"app/api/colaboradores/options/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/colaboradores/options/route.ts",nextConfigOutput:"",userland:a}),{requestAsyncStorage:d,staticGenerationAsyncStorage:R,serverHooks:m}=c,E="/api/colaboradores/options/route";function g(){return(0,s.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:R})}},87916:(e,o,r)=>{e.exports=r(30517)}};var o=require("../../../../webpack-runtime.js");o.C(e);var r=e=>o(o.s=e),a=o.X(0,[2035],()=>r(41972));module.exports=a})();