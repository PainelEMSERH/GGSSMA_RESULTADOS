"use strict";(()=>{var a={};a.id=3591,a.ids=[3591],a.modules={53524:a=>{a.exports=require("@prisma/client")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},35067:(a,e,o)=>{o.r(e),o.d(e,{originalPathname:()=>p,patchFetch:()=>I,requestAsyncStorage:()=>u,routeModule:()=>T,serverHooks:()=>N,staticGenerationAsyncStorage:()=>l});var r={};o.r(r),o.d(r,{POST:()=>E,dynamic:()=>s,runtime:()=>n});var t=o(87916),i=o(49930),c=o(2169),d=o(37913);let n="nodejs",s="force-dynamic";async function E(a){let{prisma:e}=await o.e(5892).then(o.bind(o,65892));try{let{nome:o,matricula:r,funcaoId:t,unidadeId:i,email:c,telefone:n}=await a.json();if(!o||!r||!t||!i)return Response.json({ok:!1,error:"Campos obrigat\xf3rios ausentes"},{status:200});let s=await e.colaborador.create({data:{nome:o,matricula:r,funcaoId:t,unidadeId:i,email:c||null,telefone:n||null,status:"ativo"}});return await (0,d.k)(e),await e.$executeRawUnsafe("INSERT INTO colaborador_vinculo (colaboradorId, unidadeId, inicio) VALUES ($1,$2,NOW())",s.id,i),Response.json({ok:!0,id:s.id})}catch(a){return console.error("[colaboradores/create] error",a),Response.json({ok:!1,error:"fail"},{status:200})}}let T=new t.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/colaboradores/create/route",pathname:"/api/colaboradores/create",filename:"route",bundlePath:"app/api/colaboradores/create/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/colaboradores/create/route.ts",nextConfigOutput:"",userland:r}),{requestAsyncStorage:u,staticGenerationAsyncStorage:l,serverHooks:N}=T,p="/api/colaboradores/create/route";function I(){return(0,c.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:l})}},37913:(a,e,o)=>{o.d(e,{k:()=>r});async function r(a){try{await a.$executeRawUnsafe(`
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
    `)}catch(a){}}},87916:(a,e,o)=>{a.exports=o(30517)}};var e=require("../../../../webpack-runtime.js");e.C(a);var o=a=>e(e.s=a),r=e.X(0,[2035],()=>o(35067));module.exports=r})();