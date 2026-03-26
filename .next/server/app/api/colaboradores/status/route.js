"use strict";(()=>{var a={};a.id=9934,a.ids=[9934],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},62312:(a,o,e)=>{e.r(o),e.d(o,{originalPathname:()=>p,patchFetch:()=>I,requestAsyncStorage:()=>u,routeModule:()=>T,serverHooks:()=>N,staticGenerationAsyncStorage:()=>l});var t={};e.r(t),e.d(t,{POST:()=>E,dynamic:()=>n,runtime:()=>d});var r=e(87916),i=e(49930),s=e(2169),c=e(37913);let d="nodejs",n="force-dynamic";async function E(a){let{prisma:o}=await e.e(5892).then(e.bind(e,65892));await (0,c.k)(o);try{let{colaboradorId:e,status:t,data:r}=await a.json();if(!e||!t)return Response.json({ok:!1,error:"Dados inv\xe1lidos"});return await o.$executeRawUnsafe("UPDATE colaborador SET status = $1 WHERE id = $2",t,e),"inativo"===t&&await o.$executeRawUnsafe("INSERT INTO colaborador_situacao (colaboradorId, tipo, inicio) VALUES ($1,'desligado',$2)",e,r||new Date().toISOString().substring(0,10)),Response.json({ok:!0})}catch(a){return console.error("[colaboradores/status] error",a),Response.json({ok:!1,error:"fail"},{status:200})}}let T=new r.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/colaboradores/status/route",pathname:"/api/colaboradores/status",filename:"route",bundlePath:"app/api/colaboradores/status/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/colaboradores/status/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:u,staticGenerationAsyncStorage:l,serverHooks:N}=T,p="/api/colaboradores/status/route";function I(){return(0,s.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:l})}},37913:(a,o,e)=>{e.d(o,{k:()=>t});async function t(a){try{await a.$executeRawUnsafe(`
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
    `)}catch(a){}try{await a.$executeRawUnsafe(`
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
    `)}catch(a){}}},87916:(a,o,e)=>{a.exports=e(30517)}};var o=require("../../../../webpack-runtime.js");o.C(a);var e=a=>o(o.s=a),t=o.X(0,[2035],()=>e(62312));module.exports=t})();