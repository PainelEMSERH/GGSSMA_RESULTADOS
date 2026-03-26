"use strict";(()=>{var o={};o.id=7358,o.ids=[7358],o.modules={53524:o=>{o.exports=require("@prisma/client")},20399:o=>{o.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:o=>{o.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},87156:(o,a,e)=>{e.r(a),e.d(a,{originalPathname:()=>p,patchFetch:()=>I,requestAsyncStorage:()=>u,routeModule:()=>T,serverHooks:()=>N,staticGenerationAsyncStorage:()=>l});var r={};e.r(r),e.d(r,{POST:()=>E,dynamic:()=>n,runtime:()=>s});var t=e(87916),i=e(49930),c=e(2169),d=e(37913);let s="nodejs",n="force-dynamic";async function E(o){let{prisma:a}=await e.e(5892).then(e.bind(e,65892));await (0,d.k)(a);try{let{colaboradorId:e,tipo:r,inicio:t,fim:i}=await o.json();if(!e||!r||!t)return Response.json({ok:!1,error:"Dados inv\xe1lidos"});return await a.$executeRawUnsafe("INSERT INTO colaborador_situacao (colaboradorId, tipo, inicio, fim) VALUES ($1,$2,$3,$4)",e,r,t,i||null),Response.json({ok:!0})}catch(o){return console.error("[colaboradores/situacao] error",o),Response.json({ok:!1,error:"fail"},{status:200})}}let T=new t.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/colaboradores/situacao/route",pathname:"/api/colaboradores/situacao",filename:"route",bundlePath:"app/api/colaboradores/situacao/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/colaboradores/situacao/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:u,staticGenerationAsyncStorage:l,serverHooks:N}=T,p="/api/colaboradores/situacao/route";function I(){return(0,c.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:l})}},37913:(o,a,e)=>{e.d(a,{k:()=>r});async function r(o){try{await o.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS colaborador_vinculo (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        colaboradorId TEXT NOT NULL,
        unidadeId TEXT NOT NULL,
        inicio TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        fim TIMESTAMPTZ NULL,
        CONSTRAINT fk_cv_colab FOREIGN KEY (colaboradorId) REFERENCES colaborador(id),
        CONSTRAINT fk_cv_unid  FOREIGN KEY (unidadeId) REFERENCES unidade(id)
      );
      CREATE INDEX IF NOT EXISTS idx_cv_colab ON colaborador_vinculo(colaboradorId, inicio, fim);
    `)}catch(o){}try{await o.$executeRawUnsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'situacao_tipo') THEN
          CREATE TYPE situacao_tipo AS ENUM ('afastamento','ferias','licenca_maternidade','licenca_medica','outro','desligado');
        END IF;
      END $$;
      CREATE TABLE IF NOT EXISTS colaborador_situacao (
        id TEXT PRIMARY KEY DEFAULT substr(md5(random()::text || clock_timestamp()::text), 1, 24),
        colaboradorId TEXT NOT NULL,
        tipo situacao_tipo NOT NULL,
        inicio DATE NOT NULL,
        fim DATE NULL,
        criadoEm TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_cs_colab FOREIGN KEY (colaboradorId) REFERENCES colaborador(id)
      );
      CREATE INDEX IF NOT EXISTS idx_cs_colab ON colaborador_situacao(colaboradorId, inicio, fim);
    `)}catch(o){}}},87916:(o,a,e)=>{o.exports=e(30517)}};var a=require("../../../../webpack-runtime.js");a.C(o);var e=o=>a(a.s=o),r=a.X(0,[2035],()=>e(87156));module.exports=r})();