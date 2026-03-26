"use strict";(()=>{var e={};e.id=4223,e.ids=[4223,5892],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},84770:e=>{e.exports=require("crypto")},76467:(e,a,r)=>{r.r(a),r.d(a,{originalPathname:()=>g,patchFetch:()=>R,requestAsyncStorage:()=>E,routeModule:()=>c,serverHooks:()=>l,staticGenerationAsyncStorage:()=>m});var t={};r.r(t),r.d(t,{POST:()=>u});var o=r(87916),i=r(49930),n=r(2169),s=r(4389),d=r(65892),T=r(84770),p=r.n(T);async function u(e){try{let a=await e.json(),r=a?.colaborador,t=Array.isArray(a?.itens)?a.itens:[],o=a?.obs??"";if(!r?.cpf)return s.NextResponse.json({ok:!1,error:"colaborador inv\xe1lido"},{status:400});await d.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega (
        id TEXT PRIMARY KEY,
        data TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        regional TEXT,
        unidade TEXT,
        colaborador_cpf TEXT,
        colaborador_nome TEXT,
        funcao TEXT,
        responsavel_user_id TEXT,
        observacao TEXT
      );
    `),await d.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS entrega_item (
        id TEXT PRIMARY KEY,
        entrega_id TEXT,
        item TEXT,
        nome_site TEXT,
        qtd_solicitada NUMERIC,
        qtd_entregue NUMERIC,
        qtd_pendente NUMERIC
      );
    `),await d.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS pendencia (
        id TEXT PRIMARY KEY,
        entrega_id TEXT,
        colaborador_cpf TEXT,
        item TEXT,
        quantidade NUMERIC,
        status TEXT,
        aberta_em TIMESTAMPTZ DEFAULT NOW()
      );
    `);let i=p().randomUUID();for(let e of(await d.prisma.$executeRawUnsafe(`
      INSERT INTO entrega (id, regional, unidade, colaborador_cpf, colaborador_nome, funcao, responsavel_user_id, observacao)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `,i,r.regional,r.unidade_hospitalar,r.cpf,r.colaborador,r.funcao,"",o),t)){let a=Number(e.qtdSolicitada??0),t=Number(e.qtdEntregue??0),o=Math.max(0,a-t);await d.prisma.$executeRawUnsafe(`
        INSERT INTO entrega_item (id, entrega_id, item, nome_site, qtd_solicitada, qtd_entregue, qtd_pendente)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,p().randomUUID(),i,String(e.item),String(e.nome_site??e.item),a,t,o),o>0&&await d.prisma.$executeRawUnsafe(`
          INSERT INTO pendencia (id, entrega_id, colaborador_cpf, item, quantidade, status)
          VALUES ($1, $2, $3, $4, $5, 'aberta')
        `,p().randomUUID(),i,r.cpf,String(e.item),o)}return s.NextResponse.json({ok:!0,entregaId:i})}catch(e){return s.NextResponse.json({ok:!1,error:e?.message||"erro"},{status:500})}}let c=new o.AppRouteRouteModule({definition:{kind:i.x.APP_ROUTE,page:"/api/entregas/save/route",pathname:"/api/entregas/save",filename:"route",bundlePath:"app/api/entregas/save/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/entregas/save/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:E,staticGenerationAsyncStorage:m,serverHooks:l}=c,g="/api/entregas/save/route";function R(){return(0,n.patchFetch)({serverHooks:l,staticGenerationAsyncStorage:m})}},65892:(e,a,r)=>{r.d(a,{prisma:()=>o});var t=r(53524);let o=globalThis.prisma??new t.PrismaClient({log:["error","warn"]})},87916:(e,a,r)=>{e.exports=r(30517)}};var a=require("../../../../webpack-runtime.js");a.C(e);var r=e=>a(a.s=e),t=a.X(0,[2035,4389],()=>r(76467));module.exports=t})();