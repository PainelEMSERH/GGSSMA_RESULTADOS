"use strict";(()=>{var a={};a.id=8476,a.ids=[8476,5892],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},60042:(a,e,t)=>{t.r(e),t.d(e,{originalPathname:()=>g,patchFetch:()=>v,requestAsyncStorage:()=>u,routeModule:()=>c,serverHooks:()=>_,staticGenerationAsyncStorage:()=>l});var i={};t.r(i),t.d(i,{POST:()=>p});var o=t(87916),r=t(49930),s=t(2169),n=t(4389),d=t(65892);async function p(a){try{let{regional:e,unidade:t,ano_gestao:i,atividade_codigo:o,data_conclusao:r}=await a.json();if(!e||!t||!i||!o)return n.NextResponse.json({ok:!1,error:"Regional, unidade, ano e c\xf3digo da atividade s\xe3o obrigat\xf3rios"},{status:400});let s=null;if(r&&String(r).trim()){let a=String(r).trim();if(/^\d{4}-\d{2}-\d{2}$/.test(a))s=a;else{if(!/^\d{2}\/\d{2}\/\d{4}$/.test(a))return n.NextResponse.json({ok:!1,error:"Formato de data inv\xe1lido. Use DD/MM/YYYY ou YYYY-MM-DD"},{status:400});let[e,t,i]=a.split("/");s=`${i}-${t}-${e}`}}let p=String(e).replace(/'/g,"''"),c=String(t).replace(/'/g,"''"),u=parseInt(String(i),10),l=parseInt(String(o),10);if(isNaN(u)||isNaN(l))return n.NextResponse.json({ok:!1,error:"Ano e c\xf3digo da atividade devem ser n\xfameros"},{status:400});s?await d.prisma.$executeRawUnsafe(`
          UPDATE cronograma_cipa
          SET data_conclusao = $1::date
          WHERE TRIM(regional) = $2
            AND TRIM(unidade) = $3
            AND ano_gestao = $4
            AND atividade_codigo = $5
        `,s,p,c,u,l):await d.prisma.$executeRawUnsafe(`
          UPDATE cronograma_cipa
          SET data_conclusao = NULL
          WHERE TRIM(regional) = $1
            AND TRIM(unidade) = $2
            AND ano_gestao = $3
            AND atividade_codigo = $4
        `,p,c,u,l);let _=await d.prisma.$queryRawUnsafe(`
        SELECT id, regional, unidade, ano_gestao, atividade_codigo, atividade_nome,
               data_inicio_prevista::text AS data_inicio_prevista,
               data_fim_prevista::text AS data_fim_prevista,
               data_conclusao::text AS data_conclusao,
               data_posse_gestao::text AS data_posse_gestao
        FROM cronograma_cipa
        WHERE TRIM(regional) = $1
          AND TRIM(unidade) = $2
          AND ano_gestao = $3
          AND atividade_codigo = $4
        LIMIT 1
      `,p,c,u,l);return n.NextResponse.json({ok:!0,row:_[0]?{id:_[0].id,regional:String(_[0].regional??""),unidade:String(_[0].unidade??""),ano_gestao:Number(_[0].ano_gestao)||0,atividade_codigo:Number(_[0].atividade_codigo)||0,atividade_nome:String(_[0].atividade_nome??""),data_inicio_prevista:_[0].data_inicio_prevista?String(_[0].data_inicio_prevista).slice(0,10):null,data_fim_prevista:_[0].data_fim_prevista?String(_[0].data_fim_prevista).slice(0,10):null,data_conclusao:_[0].data_conclusao?String(_[0].data_conclusao).slice(0,10):null,data_posse_gestao:_[0].data_posse_gestao?String(_[0].data_posse_gestao).slice(0,10):null}:null})}catch(a){return console.error("[cipa/save] error",a),n.NextResponse.json({ok:!1,error:String(a?.message??a)},{status:500})}}let c=new o.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/cipa/save/route",pathname:"/api/cipa/save",filename:"route",bundlePath:"app/api/cipa/save/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/cipa/save/route.ts",nextConfigOutput:"",userland:i}),{requestAsyncStorage:u,staticGenerationAsyncStorage:l,serverHooks:_}=c,g="/api/cipa/save/route";function v(){return(0,s.patchFetch)({serverHooks:_,staticGenerationAsyncStorage:l})}},65892:(a,e,t)=>{t.d(e,{prisma:()=>o});var i=t(53524);let o=globalThis.prisma??new i.PrismaClient({log:["error","warn"]})},87916:(a,e,t)=>{a.exports=t(30517)}};var e=require("../../../../webpack-runtime.js");e.C(a);var t=a=>e(e.s=a),i=e.X(0,[2035,4389],()=>t(60042));module.exports=i})();