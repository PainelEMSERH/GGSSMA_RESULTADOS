"use strict";(()=>{var e={};e.id=4018,e.ids=[4018],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},2826:(e,r,a)=>{a.r(r),a.d(r,{originalPathname:()=>x,patchFetch:()=>_,requestAsyncStorage:()=>p,routeModule:()=>l,serverHooks:()=>m,staticGenerationAsyncStorage:()=>g});var t={};a.r(t),a.d(t,{POST:()=>c,dynamic:()=>u});var o=a(87916),n=a(49930),i=a(2169),s=a(4389),d=a(27191);let u="force-dynamic";async function c(e){let r=await e.json();if(!r?.colaborador?.id||!r.data_entrega||!Array.isArray(r.itens))return s.NextResponse.json({error:"Payload inv\xe1lido"},{status:400});let a=new Date(r.data_entrega+"T00:00:00");try{return await d.Z.$executeRawUnsafe(`
      create table if not exists entrega_epi (
        id bigserial primary key,
        colaborador_id text,
        colaborador_nome text,
        funcao text,
        unidade text,
        regional text,
        nome_site text,
        epi_item text,
        quantidade numeric,
        entregue boolean,
        data_entrega date,
        created_at timestamp default now()
      )
    `),await d.Z.$transaction(async e=>{for(let t of r.itens)await e.$executeRawUnsafe(`insert into entrega_epi (colaborador_id, colaborador_nome, funcao, unidade, regional, nome_site, epi_item, quantidade, entregue, data_entrega)
            values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,r.colaborador.id,r.colaborador.nome,r.colaborador.funcao,r.colaborador.unidade,r.colaborador.regional,r.colaborador.nome_site??null,t.epi_item,t.quantidade,!!t.entregue,a)}),s.NextResponse.json({ok:!0})}catch(e){return console.error(e),s.NextResponse.json({error:"Falha ao registrar entrega"},{status:500})}}let l=new o.AppRouteRouteModule({definition:{kind:n.x.APP_ROUTE,page:"/api/entregas/record/route",pathname:"/api/entregas/record",filename:"route",bundlePath:"app/api/entregas/record/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/entregas/record/route.ts",nextConfigOutput:"",userland:t}),{requestAsyncStorage:p,staticGenerationAsyncStorage:g,serverHooks:m}=l,x="/api/entregas/record/route";function _(){return(0,i.patchFetch)({serverHooks:m,staticGenerationAsyncStorage:g})}},27191:(e,r,a)=>{a.d(r,{Z:()=>o});var t=a(53524);let o=globalThis.prisma??new t.PrismaClient({log:["error"]})},87916:(e,r,a)=>{e.exports=a(30517)}};var r=require("../../../../webpack-runtime.js");r.C(e);var a=e=>r(r.s=e),t=r.X(0,[2035,4389],()=>a(2826));module.exports=t})();