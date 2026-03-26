"use strict";(()=>{var e={};e.id=9847,e.ids=[9847],e.modules={53524:e=>{e.exports=require("@prisma/client")},20399:e=>{e.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:e=>{e.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},54260:(e,E,a)=>{a.r(E),a.d(E,{originalPathname:()=>u,patchFetch:()=>P,requestAsyncStorage:()=>s,routeModule:()=>C,serverHooks:()=>o,staticGenerationAsyncStorage:()=>d});var A={};a.r(A),a.d(A,{GET:()=>L,dynamic:()=>r,runtime:()=>n});var t=a(87916),O=a(49930),R=a(2169),S=a(18789),I=a(12846);let n="nodejs",r="force-dynamic";function T(e,E){return new Date(Date.UTC(e,E-1,1,0,0,0))}function i(e,E){return new Date(Date.UTC(e,E,0,23,59,59))}async function N(e,E){if(!E||!E.trim())return"";try{let a=E.trim().replace(/'/g,"''"),A=await e.$queryRawUnsafe(`
      SELECT DISTINCT nmdepartamento AS unidade
      FROM stg_unid_reg
      WHERE UPPER(TRIM(regional_responsavel)) = UPPER(TRIM('${a}'))
    `);if(A&&A.length>0){let e=A.map(e=>{let E=String(e.unidade||"").trim();return E?`'${E.replace(/'/g,"''")}'`:null}).filter(Boolean);if(e.length>0)return`AND a.unidade IN (${e.join(",")})`}let t=E.trim().toUpperCase(),O=[];for(let[e,E]of Object.entries(I.Cm))E===t&&O.push(`'${e.replace(/'/g,"''")}'`);if(O.length>0)return`AND a.unidade IN (${O.join(",")})`}catch{}return""}async function L(e){let{prisma:E}=await a.e(5892).then(a.bind(a,65892)),{searchParams:A}=new URL(e.url),t=A.get("regional")||"",O=new Date,R=O.getUTCFullYear(),I=O.getUTCMonth()+1,n=T(R,I),r=i(R,I),L=n.toISOString().substring(0,10),C=r.toISOString().substring(0,10),s={metaMensal:{valorMeta:0,realizado:0},variacaoMensalPerc:0,metaAnual:{valorMeta:0,realizado:0},colaboradoresAtendidos:0,itensEntregues:0,pendenciasAbertas:0,topItens:[]},d={labels:[],entregas:[],itens:[]},o={estoqueAbaixoMinimo:[],pendenciasVencidas:0},u=await N(E,t);try{let e=await E.$queryRawUnsafe(`
      SELECT COUNT(*)::int AS c
      FROM stg_alterdata a
      WHERE a.admissao <= '${C}'::date
        AND (a.demissao IS NULL OR a.demissao >= '${L}'::date)
        ${u}
    `);s.colaboradoresAtendidos=Number(e?.[0]?.c||0)}catch{}try{let e=`
      WITH elig AS (
        SELECT UPPER(REGEXP_REPLACE(a.funcao,'[^A-Z0-9]+','','g')) AS func_key
        FROM stg_alterdata a
        WHERE a.admissao <= '${C}'::date
          AND (a.demissao IS NULL OR a.demissao >= '${L}'::date)
          ${u}
      )
    `,a=(0,S.a)("m.epi_item"),A=await E.$queryRawUnsafe(`${e}
      SELECT COALESCE(SUM(m.quantidade),0)::int AS q
      FROM elig e
      JOIN stg_epi_map m
        ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
       WHERE ${a}
    `),t=Number(A?.[0]?.q||0);s.metaMensal.valorMeta=t,s.metaAnual.valorMeta=12*t;let O=await E.$queryRawUnsafe(`${e}
      SELECT m.epi_item AS nome, SUM(m.quantidade)::int AS quantidade
      FROM elig e
      JOIN stg_epi_map m
        ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
       WHERE ${a}
      GROUP BY m.epi_item
      ORDER BY quantidade DESC
      LIMIT 5
    `);s.topItens=(O||[]).map((e,E)=>({itemId:String(E+1),nome:String(e.nome),quantidade:Number(e.quantidade||0)}))}catch{}try{let e=(0,S.a)("b.item"),a=await E.$queryRawUnsafe(`
      WITH base AS (
        SELECT
          e.item,
          (elem->>'date')::date AS data,
          (elem->>'qty')::int  AS quantidade
        FROM epi_entregas e
        CROSS JOIN LATERAL jsonb_array_elements(e.deliveries) elem
      )
      SELECT COALESCE(SUM(b.quantidade),0)::int AS q
      FROM base b
      WHERE b.data >= '${L}'::date
        AND b.data <= '${C}'::date
        AND ${e}
    `),A=Number(a?.[0]?.q||0);s.itensEntregues=A,s.metaMensal.realizado=A,s.metaAnual.realizado=A}catch{}try{let e=await E.$queryRawUnsafe(`
      SELECT 
        SUM(CASE WHEN status = 'aberta' THEN 1 ELSE 0 END)::int AS abertas,
        SUM(CASE WHEN status = 'aberta' AND prazo < NOW() THEN 1 ELSE 0 END)::int AS vencidas
      FROM pendencia
    `);s.pendenciasAbertas=Number(e?.[0]?.abertas||0),o.pendenciasVencidas=Number(e?.[0]?.vencidas||0)}catch{}try{let e=await E.$queryRawUnsafe(`
      SELECT u.nome AS unidade, i.nome AS item, e.quantidade::int AS quantidade, e.minimo::int AS minimo
        FROM estoque e
        JOIN item i ON i.id = e."itemId"
        JOIN unidade u ON u.id = e."unidadeId"
       WHERE (e.quantidade < e.minimo)
       ORDER BY e.quantidade ASC
       LIMIT 6
    `);o.estoqueAbaixoMinimo=(e||[]).map(e=>({unidade:String(e.unidade),item:String(e.item),quantidade:Number(e.quantidade||0),minimo:Number(e.minimo||0)}))}catch{}try{let e=[],a=[],A=[],O=new Date(n);for(let R=-5;R<=0;R++){let I=function(e,E){let a=new Date(e);return a.setUTCMonth(a.getUTCMonth()+E),a}(O,R),n=I.getUTCFullYear(),r=I.getUTCMonth()+1,L=T(n,r).toISOString().substring(0,10),C=i(n,r).toISOString().substring(0,10);e.push(String(r).padStart(2,"0")+"/"+n);try{let e=await N(E,t),A=`
          WITH elig AS (
            SELECT UPPER(REGEXP_REPLACE(a.funcao,'[^A-Z0-9]+','','g')) AS func_key
            FROM stg_alterdata a
            WHERE a.admissao <= '${C}'::date
              AND (a.demissao IS NULL OR a.demissao >= '${L}'::date)
              ${e}
          )
        `,O=(0,S.a)("m.epi_item"),R=await E.$queryRawUnsafe(`${A}
          SELECT COALESCE(SUM(m.quantidade),0)::int AS q
          FROM elig e
          JOIN stg_epi_map m
            ON UPPER(REGEXP_REPLACE(m.alterdata_funcao,'[^A-Z0-9]+','','g')) = e.func_key
           WHERE ${O}
        `);a.push(Number(R?.[0]?.q||0))}catch{a.push(0)}try{let e=(0,S.a)("b.item"),a=await E.$queryRawUnsafe(`
          WITH base AS (
            SELECT
              e.item,
              (elem->>'date')::date AS data,
              (elem->>'qty')::int  AS quantidade
            FROM epi_entregas e
            CROSS JOIN LATERAL jsonb_array_elements(e.deliveries) elem
          )
          SELECT COALESCE(SUM(b.quantidade),0)::int AS q
          FROM base b
          WHERE b.data >= '${L}'::date
            AND b.data <= '${C}'::date
            AND ${e}
        `);A.push(Number(a?.[0]?.q||0))}catch{A.push(0)}}d={labels:e,entregas:A,itens:a}}catch{}return s.metaMensal.valorMeta>0?s.variacaoMensalPerc=Number(((s.metaMensal.realizado-s.metaMensal.valorMeta)/s.metaMensal.valorMeta*100).toFixed(1)):s.variacaoMensalPerc=0,new Response(JSON.stringify({kpis:s,series:d,alertas:o}),{headers:{"content-type":"application/json"}})}let C=new t.AppRouteRouteModule({definition:{kind:O.x.APP_ROUTE,page:"/api/dashboard/metrics/route",pathname:"/api/dashboard/metrics",filename:"route",bundlePath:"app/api/dashboard/metrics/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/dashboard/metrics/route.ts",nextConfigOutput:"",userland:A}),{requestAsyncStorage:s,staticGenerationAsyncStorage:d,serverHooks:o}=C,u="/api/dashboard/metrics/route";function P(){return(0,R.patchFetch)({serverHooks:o,staticGenerationAsyncStorage:d})}},18789:(e,E,a)=>{a.d(E,{M:()=>R,a:()=>S});let A=["M\xe1scara N95","Luva Nitr\xedlica","Luva nitr\xedlica para prote\xe7\xe3o qu\xedmica e biol\xf3gica","Bota de PVC","Bota PVC","Avental de PVC","\xd3culos de prote\xe7\xe3o","Luva de L\xe1tex","Luva L\xe1tex","Cinto de Seguran\xe7a","Talabarte de Seguran\xe7a","Avental de chumbo ou plumb\xedfero","\xd3culos plumb\xedferos","Protetores de g\xf4nadas","Protetores de tireoide","M\xe1scara 6200"];function t(e){return String(e||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().trim().replace(/\s+/g," ").replace(/[^A-Z0-9 ]/g,"")}let O=new Set([...A,"AVENTAL DE CHUMBO","AVENTAL PLUMBIFERO","AVENTAL PLUMBIFERO OU DE CHUMBO","OCULOS PLUMBIFERO","OCULOS PLUMBIFEROS","PROTETOR DE GONADAS","PROTETORES DE GONADAS","PROTETOR DE TIREOIDE","PROTETORES DE TIREOIDE"].map(e=>t(e)));function R(e){return!!e&&O.has(t(String(e)))}function S(e){let E=Array.from(new Set(A.map(e=>String(e).toUpperCase().trim()))).map(e=>`'${e.replace(/'/g,"''")}'`).join(", ");return`UPPER(TRIM(${e})) IN (${E})`}},12846:(e,E,a)=>{function A(e){return e?e.normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/\s+/g," ").replace(/\s-\s/g,"-").trim():""}a.d(E,{Cm:()=>t,Tv:()=>A});let t={"AGENCIA TRANSFUSIONAL BARRA DO CORDA":"CENTRO","AGENCIA TRANSFUSIONAL CHAPADINHA":"LESTE","AGENCIA TRANSFUSIONAL COLINAS":"CENTRO","AGENCIA TRANSFUSIONAL DE SAO JOAO DOS PATOS":"CENTRO","AGENCIA TRANSFUSIONAL DE VIANA":"NORTE","AGENCIA TRANSFUSIONAL TIMON":"LESTE","CAF-FEME":"NORTE","CAF-SEDE EMSERH":"NORTE","CASA DA GESTANTE, BEBE E PUERPERA":"SUL","CASA TEA 12+":"NORTE","CENTRAL DE REGULACAO-AMBULATORIAL":"NORTE","CENTRAL DE REGULACAO-LEITOS":"NORTE","CENTRAL DE REGULACAO-TRANSPORTE":"NORTE","CENTRO DA PESSOA IDOSA":"SUL","CENTRO DE SAUDE GENESIO REGO":"NORTE","CENTRO DE TERAPIA RENAL SUBSTITUTIVA":"NORTE","CENTRO ESPECIALIDADES MEDICAS PAM DIAMANTE":"NORTE","CENTRO ESPECIALIZADO DE REAB. CIDADE OPERARIA":"NORTE","CENTRO ESPECIALIZADO DE REABILITACAO OLHO D AGUA":"NORTE","EMSERH SEDE":"NORTE","EMSERH SEDE DIRETORIA":"NORTE",FEME:"NORTE","FEME-UGAF":"NORTE","FEME DE CAXIAS":"LESTE","FEME IMPERATRIZ":"SUL",FESMA:"NORTE",HEMOMAR:"NORTE","HEMONUCLEO DE BACABAL":"CENTRO","HEMONUCLEO DE BALSAS":"SUL","HEMONUCLEO DE CAXIAS":"LESTE","HEMONUCLEO DE CODO":"LESTE","HEMONUCLEO DE IMPERATRIZ":"SUL","HEMONUCLEO DE PEDREIRAS":"CENTRO","HEMONUCLEO PINHEIRO":"NORTE","HEMONUCLEO SANTA INES":"SUL","HOSPITAL ADELIA MATOS FONSECA":"LESTE","HOSPITAL AQUILES LISBOA":"NORTE","HOSPITAL DA ILHA":"NORTE","HOSPITAL DE BARREIRINHAS":"NORTE","HOSPITAL DE CUIDADOS INTENSIVOS-HCI":"NORTE","HOSPITAL DE PAULINO NEVES":"NORTE","HOSPITAL DE PEDREIRAS":"CENTRO","HOSPITAL E MATERNIDADE ADERSON MARINHO-P. FRANCO":"SUL","HOSPITAL GENESIO REGO":"NORTE","HOSPITAL GERAL DE ALTO ALEGRE":"LESTE","HOSPITAL GERAL DE GRAJAU":"CENTRO","HOSPITAL GERAL DE PERITORO":"LESTE","HOSPITAL MACROREGIONAL DE CAXIAS":"LESTE","HOSPITAL MACROREGIONAL DE COROATA":"LESTE","HOSPITAL MACRORREGIONAL DRA RUTH NOLETO":"SUL","HOSPITAL MATERNO INFANTIL IMPERATRIZ":"SUL","HOSPITAL PRESIDENTE DUTRA":"CENTRO","HOSPITAL PRESIDENTE VARGAS":"NORTE","HOSPITAL REGIONAL ALARICO NUNES PACHECO-TIMON":"LESTE","HOSPITAL REGIONAL DE BARRA DO CORDA":"CENTRO","HOSPITAL REGIONAL DE CARUTAPERA":"NORTE","HOSPITAL REGIONAL DE CHAPADINHA":"LESTE","HOSPITAL REGIONAL DE LAGO DA PEDRA":"CENTRO","HOSPITAL REGIONAL DE MORROS":"NORTE","HOSPITAL REGIONAL DE TIMBIRAS":"LESTE","HOSPITAL REGIONAL SANTA LUZIA DO PARUA":"NORTE","HOSPITAL VILA LUIZAO":"NORTE",LACEN:"NORTE","LACEN IMPERATRIZ":"SUL","POLICLINICA ACAILANDIA":"SUL","POLICLINICA BARRA DO CORDA":"CENTRO","POLICLINICA CAXIAS":"LESTE","POLICLINICA CIDADE OPERARIA":"NORTE","POLICLINICA COHATRAC":"NORTE","POLICLINICA DE CODO":"LESTE","POLICLINICA DE IMPERATRIZ":"SUL","POLICLINICA DE MATOES DO NORTE":"LESTE","POLICLINICA DO COROADINHO":"NORTE","POLICLINICA DO CUJUPE":"NORTE","POLICLINICA VILA LUIZAO":"NORTE","POLICLINICA VINHAIS":"NORTE","PROGRAMA DE ACAO INTEGRADA PARA APOSENTADOS-PAI":"NORTE","RESIDENCIA MEDICA E MULTI-ANALISTAS TECNICOS":"NORTE","SHOPPING DA CRIANCA":"NORTE","SOLAR DO OUTONO":"NORTE","SVO -SERV. VERIFICACAO DE OBITOS-SAO LUIS":"NORTE","SVO -SERV. VERIFICACAO DE OBITOS-TIMON":"LESTE","SVO -SERV.VERIFICACAO DE OBITOS-IMPERATRIZ":"SUL","TEA-CENTRO ESPECIALIZADO DE REAB. OLHO D AGUA":"NORTE","UPA ARACAGY":"NORTE","UPA CIDADE OPERARIA":"NORTE","UPA CODO":"LESTE","UPA COROATA":"LESTE","UPA DE IMPERATRIZ":"SUL","UPA ITAQUI BACANGA":"NORTE","UPA PACO DO LUMIAR":"NORTE","UPA PARQUE VITORIA":"NORTE","UPA SAO JOAO DOS PATOS":"CENTRO","UPA TIMON":"LESTE","UPA VINHAIS":"NORTE"}},87916:(e,E,a)=>{e.exports=a(30517)}};var E=require("../../../../webpack-runtime.js");E.C(e);var a=e=>E(E.s=e),A=E.X(0,[2035],()=>a(54260));module.exports=A})();