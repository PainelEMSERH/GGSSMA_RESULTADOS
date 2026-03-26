"use strict";(()=>{var e={};e.id=977,e.ids=[977,5892],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},20935:(e,r,a)=>{a.r(r),a.d(r,{originalPathname:()=>E,patchFetch:()=>m,requestAsyncStorage:()=>c,routeModule:()=>u,serverHooks:()=>T,staticGenerationAsyncStorage:()=>l});var t={};a.r(t),a.d(t,{POST:()=>p});var o=a(87916),s=a(49930),n=a(2169),i=a(4389),d=a(65892);async function p(e){try{let{colaboradorCpf:r,entregue:a,dataEntrega:t,responsavel:o}=await e.json();if(!r)return i.NextResponse.json({ok:!1,error:"CPF do colaborador \xe9 obrigat\xf3rio"},{status:400});await d.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS ordem_servico (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        colaborador_cpf TEXT NOT NULL,
        entregue BOOLEAN NOT NULL DEFAULT false,
        data_entrega DATE,
        responsavel TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(colaborador_cpf)
      );
    `),await d.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_colaborador_cpf ON ordem_servico(colaborador_cpf);
    `),await d.prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_ordem_servico_data_entrega ON ordem_servico(data_entrega);
    `);let s=t?new Date(t):null;if(s&&isNaN(s.getTime()))return i.NextResponse.json({ok:!1,error:"Data de entrega inv\xe1lida"},{status:400});let n=`
      INSERT INTO ordem_servico (colaborador_cpf, entregue, data_entrega, responsavel, updated_at)
      VALUES ($1, $2, $3::date, $4, NOW())
      ON CONFLICT (colaborador_cpf) 
      DO UPDATE SET
        entregue = EXCLUDED.entregue,
        data_entrega = EXCLUDED.data_entrega,
        responsavel = EXCLUDED.responsavel,
        updated_at = NOW()
      RETURNING id, colaborador_cpf, entregue, data_entrega::text as data_entrega, responsavel
    `,p=await d.prisma.$queryRawUnsafe(n,r,!0===a||"true"===a,s?s.toISOString().split("T")[0]:null,o||null);return i.NextResponse.json({ok:!0,data:p[0]})}catch(e){return console.error("[ordem-servico/save] error",e),i.NextResponse.json({ok:!1,error:String(e?.message||e)},{status:500})}}let u=new o.AppRouteRouteModule({definition:{kind:s.x.APP_ROUTE,page:"/api/ordem-servico/save/route",pathname:"/api/ordem-servico/save",filename:"route",bundlePath:"app/api/ordem-servico/save/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/ordem-servico/save/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:c,staticGenerationAsyncStorage:l,serverHooks:T}=u,E="/api/ordem-servico/save/route";function m(){return(0,n.patchFetch)({serverHooks:T,staticGenerationAsyncStorage:l})}},65892:(e,r,a)=>{a.d(r,{prisma:()=>o});var t=a(53524);let o=globalThis.prisma??new t.PrismaClient({log:["error","warn"]})},87916:(e,r,a)=>{e.exports=a(30517)}};var r=require("../../../../webpack-runtime.js");r.C(e);var a=e=>r(r.s=e),t=r.X(0,[2035,4389],()=>a(20935));module.exports=t})();