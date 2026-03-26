"use strict";(()=>{var a={};a.id=8974,a.ids=[8974],a.modules={53524:a=>{a.exports=require("@prisma/client")},72934:a=>{a.exports=require("next/dist/client/components/action-async-storage.external.js")},54580:a=>{a.exports=require("next/dist/client/components/request-async-storage.external.js")},45869:a=>{a.exports=require("next/dist/client/components/static-generation-async-storage.external.js")},20399:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},30517:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},84770:a=>{a.exports=require("crypto")},92761:a=>{a.exports=require("node:async_hooks")},6005:a=>{a.exports=require("node:crypto")},87561:a=>{a.exports=require("node:fs")},49411:a=>{a.exports=require("node:path")},58792:(a,t,e)=>{e.r(t),e.d(t,{originalPathname:()=>A,patchFetch:()=>S,requestAsyncStorage:()=>C,routeModule:()=>f,serverHooks:()=>N,staticGenerationAsyncStorage:()=>L});var o={};e.r(o),e.d(o,{POST:()=>T,runtime:()=>_});var d=e(87916),r=e(49930),i=e(2169),s=e(4389),n=e(27191),m=e(46236),c=e(29900),E=e(84770);function l(a,t){var e=Object.keys(a);if(Object.getOwnPropertySymbols){var o=Object.getOwnPropertySymbols(a);t&&(o=o.filter(function(t){return Object.getOwnPropertyDescriptor(a,t).enumerable})),e.push.apply(e,o)}return e}let _="nodejs";async function p(){let{userId:a}=await (0,m.I)();if(!a)throw Error("UNAUTHENTICATED");let t=await (0,c.a)(),e=t?.primaryEmailAddress?.emailAddress?.toLowerCase()||"";if("jonathan.alves@emserh.ma.gov.br"!==e)throw Error("FORBIDDEN");return{userId:a,email:e}}async function u(){for(let a of["CREATE EXTENSION IF NOT EXISTS pgcrypto",`CREATE TABLE IF NOT EXISTS stg_alterdata_v2_raw (
      id BIGSERIAL PRIMARY KEY,
      batch_id UUID NOT NULL,
      row_no INTEGER NOT NULL,
      data JSONB NOT NULL,
      source_file TEXT,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,`CREATE MATERIALIZED VIEW IF NOT EXISTS mv_alterdata_v2_raw_flat AS
     SELECT 
       r.row_no,
       r.batch_id,
       r.imported_at,
       r.data->>'CPF' as cpf,
       r.data->>'Matr\xedcula' as matricula,
       r.data->>'Colaborador' as colaborador,
       r.data->>'Unidade Hospitalar' as unidade_hospitalar,
       r.data->>'Fun\xe7\xe3o' as funcao,
       r.data->>'Admiss\xe3o' as admissao,
       r.data->>'Demiss\xe3o' as demissao,
       r.data->>'Nmdepartamento' as nmdepartamento,
       r.data->>'Cdchamada' as cdchamada,
       r.data as data_jsonb
     FROM stg_alterdata_v2_raw r`,"CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_batch ON mv_alterdata_v2_raw_flat (batch_id)","CREATE INDEX IF NOT EXISTS idx_mv_alterdata_raw_flat_row_no ON mv_alterdata_v2_raw_flat (row_no)",`CREATE TABLE IF NOT EXISTS stg_alterdata_v2_imports (
      batch_id UUID PRIMARY KEY,
      source_file TEXT,
      total_rows INTEGER,
      imported_by TEXT,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,`CREATE TABLE IF NOT EXISTS stg_alterdata_v2 (
      cpf TEXT,
      matricula TEXT,
      colaborador TEXT,
      unidade_hospitalar TEXT,
      cidade TEXT,
      funcao TEXT,
      estado_civil TEXT,
      sexo TEXT,
      telefone TEXT,
      data_nascimento TEXT,
      admissao TEXT,
      demissao TEXT,
      data_atestado TEXT,
      proximo_aso TEXT,
      mes_ultimo_aso TEXT,
      tipo_aso TEXT,
      periodicidade TEXT,
      status_aso TEXT,
      nome_medico TEXT,
      inicio_afastamento TEXT,
      fim_afastamento TEXT,
      celular TEXT,
      last_batch_id UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`,"CREATE UNIQUE INDEX IF NOT EXISTS ux_stg_alterdata_v2_cpf_matricula ON stg_alterdata_v2 (cpf, matricula)",`CREATE OR REPLACE FUNCTION apply_alterdata_v2_batch(p_batch UUID)
     RETURNS VOID AS $$
     BEGIN
       INSERT INTO stg_alterdata_v2 (
         cpf, matricula, colaborador, unidade_hospitalar, cidade, funcao, estado_civil, sexo,
         telefone, data_nascimento, admissao, demissao, data_atestado, proximo_aso,
         mes_ultimo_aso, tipo_aso, periodicidade, status_aso, nome_medico,
         inicio_afastamento, fim_afastamento, celular, last_batch_id, updated_at
       )
       SELECT
         CASE 
           WHEN regexp_replace(COALESCE(
             data->>'CPF', data->>'Cpf', data->>'cpf',
             data->>'NrCPF', data->>'Nrcpf', data->>'nrcpf',
             data->>'Nr CPF', data->>'nr cpf',
             ''
           ), '[^0-9]', '', 'g') != '' 
           THEN regexp_replace(COALESCE(
             data->>'CPF', data->>'Cpf', data->>'cpf',
             data->>'NrCPF', data->>'Nrcpf', data->>'nrcpf',
             data->>'Nr CPF', data->>'nr cpf'
           ), '[^0-9]', '', 'g')
           ELSE 'SEM_CPF_' || lpad(row_no::text, 10, '0')
         END as cpf,
         COALESCE(
           NULLIF(TRIM(COALESCE(
             data->>'Matr\xedcula', data->>'Matricula', data->>'matricula',
             data->>'CdChamada', data->>'Cdchamada', data->>'cdchamada',
             data->>'Cd Chamada', data->>'cd chamada',
             data->>'Chamada', data->>'chamada',
             ''
           )), ''),
           md5(COALESCE(
             data->>'Colaborador', data->>'Nome', data->>'colaborador',
             data->>'NmFuncionario', data->>'Nmfuncionario', data->>'nmfuncionario',
             data->>'Nm Funcionario', data->>'nm funcionario',
             ''
           ) || '|' || row_no::text)
         ) as matricula,
         COALESCE(NULLIF(TRIM(COALESCE(
           data->>'Colaborador', data->>'Nome', data->>'colaborador',
           data->>'NmFuncionario', data->>'Nmfuncionario', data->>'nmfuncionario',
           data->>'Nm Funcionario', data->>'nm funcionario',
           ''
         )), ''), 'SEM_NOME_' || row_no::text) as colaborador,
         COALESCE(NULLIF(TRIM(COALESCE(
           data->>'Unidade Hospitalar', data->>'Unidade', data->>'unidade_hospitalar',
           data->>'nmdepartamento', data->>'Nmdepartamento', data->>'NmDepartamento',
           data->>'Nm Departamento', data->>'nm departamento',
           data->>'Departamento', data->>'departamento',
           ''
         )), ''), '') as unidade_hospitalar,
         NULLIF(TRIM(COALESCE(
           data->>'Cidade', data->>'cidade',
           data->>'nmcidade', data->>'Nmcidade', data->>'NmCidade',
           data->>'Nm Cidade', data->>'nm cidade',
           ''
         )), '') as cidade,
         COALESCE(NULLIF(TRIM(COALESCE(
           data->>'Fun\xe7\xe3o', data->>'Funcao', data->>'Cargo', data->>'funcao',
           data->>'nmfuncao', data->>'Nmfuncao', data->>'NmFuncao',
           data->>'Nm Funcao', data->>'nm funcao',
           ''
         )), ''), '') as funcao,
         NULLIF(TRIM(COALESCE(
           data->>'Estado Civil', data->>'estado_civil',
           data->>'TpEstadoCivil', data->>'Tpestadocivil', data->>'tpestadocivil',
           data->>'Tp Estado Civil', data->>'tp estado civil',
           ''
         )), '') as estado_civil,
         NULLIF(TRIM(COALESCE(
           data->>'Sexo', data->>'sexo',
           data->>'TpSexo', data->>'Tpsexo', data->>'tpsexo',
           data->>'Tp Sexo', data->>'tp sexo',
           ''
         )), '') as sexo,
         NULLIF(TRIM(COALESCE(
           data->>'Telefone', data->>'telefone',
           data->>'NrTelefone', data->>'Nrtelefone', data->>'nrtelefone',
           data->>'Nr Telefone', data->>'nr telefone',
           ''
         )), '') as telefone,
         NULLIF(TRIM(COALESCE(
           data->>'Data Nascimento', data->>'data_nascimento',
           data->>'DtNascimento', data->>'Dtnascimento', data->>'dtnascimento',
           data->>'Dt Nascimento', data->>'dt nascimento',
           data->>'Nascimento', data->>'nascimento',
           ''
         )), '') as data_nascimento,
         NULLIF(TRIM(COALESCE(
           data->>'Admiss\xe3o', data->>'Admissao', data->>'admissao',
           data->>'DtAdmissao', data->>'Dtadmissao', data->>'dtadmissao',
           data->>'Dt Admissao', data->>'dt admissao',
           ''
         )), '') as admissao,
         NULLIF(TRIM(COALESCE(
           data->>'Demiss\xe3o', data->>'Demissao', data->>'demissao',
           data->>'DtDemissao', data->>'Dtdemissao', data->>'dtdemissao',
           data->>'Dt Demissao', data->>'dt demissao',
           ''
         )), '') as demissao,
         NULLIF(TRIM(COALESCE(
           data->>'Data Atestado', data->>'data_atestado',
           data->>'Data_Atestado', data->>'Data_atestado', data->>'data_Atestado',
           data->>'Data Atestado', data->>'data atestado',
           ''
         )), '') as data_atestado,
         NULLIF(TRIM(COALESCE(
           data->>'Pr\xf3ximo ASO', data->>'proximo_aso',
           data->>'Proximo_aso', data->>'Proximo_ASO', data->>'proximo_ASO',
           data->>'Pr\xf3ximo ASO', data->>'proximo aso',
           ''
         )), '') as proximo_aso,
         NULLIF(TRIM(COALESCE(
           data->>'M\xeas \xdaltimo ASO', data->>'mes_ultimo_aso',
           data->>'N_MES_ULTIMO_ASO', data->>'N_Mes_Ultimo_ASO', data->>'n_mes_ultimo_aso',
           data->>'N MES ULTIMO ASO', data->>'n mes ultimo aso',
           ''
         )), '') as mes_ultimo_aso,
         NULLIF(TRIM(COALESCE(
           data->>'Tipo ASO', data->>'tipo_aso',
           data->>'Tipo_ASO', data->>'Tipo_Aso', data->>'tipo_Aso',
           data->>'Tipo ASO', data->>'tipo aso',
           ''
         )), '') as tipo_aso,
         NULLIF(TRIM(COALESCE(
           data->>'Periodicidade', data->>'periodicidade',
           data->>'periodicidade', data->>'Periodicidade',
           ''
         )), '') as periodicidade,
         NULLIF(TRIM(COALESCE(
           data->>'Status ASO', data->>'status_aso',
           data->>'Status_ASO', data->>'Status_Aso', data->>'status_Aso',
           data->>'Status ASO', data->>'status aso',
           ''
         )), '') as status_aso,
         NULLIF(TRIM(COALESCE(
           data->>'Nome M\xe9dico', data->>'nome_medico',
           data->>'Nome_Medico', data->>'Nome_medico', data->>'nome_Medico',
           data->>'Nome M\xe9dico', data->>'nome medico',
           ''
         )), '') as nome_medico,
         NULLIF(TRIM(COALESCE(
           data->>'In\xedcio Afastamento', data->>'inicio_afastamento',
           data->>'In\xedcio Afastamento', data->>'Inicio_Afastamento', data->>'inicio_Afastamento',
           data->>'In\xedcio Afastamento', data->>'inicio afastamento',
           ''
         )), '') as inicio_afastamento,
         NULLIF(TRIM(COALESCE(
           data->>'Fim Afastamento', data->>'fim_afastamento',
           data->>'Fim_Afastamento', data->>'Fim_afastamento', data->>'fim_Afastamento',
           data->>'Fim Afastamento', data->>'fim afastamento',
           ''
         )), '') as fim_afastamento,
         NULLIF(TRIM(COALESCE(
           data->>'Celular', data->>'celular',
           data->>'NrCelular', data->>'Nrcelular', data->>'nrcelular',
           data->>'Nr Celular', data->>'nr celular',
           ''
         )), '') as celular,
         batch_id,
         now()
       FROM stg_alterdata_v2_raw
       WHERE batch_id = p_batch
       ON CONFLICT (cpf, matricula) DO UPDATE SET
         colaborador = EXCLUDED.colaborador,
         unidade_hospitalar = EXCLUDED.unidade_hospitalar,
         cidade = EXCLUDED.cidade,
         funcao = EXCLUDED.funcao,
         estado_civil = EXCLUDED.estado_civil,
         sexo = EXCLUDED.sexo,
         telefone = EXCLUDED.telefone,
         data_nascimento = EXCLUDED.data_nascimento,
         admissao = EXCLUDED.admissao,
         demissao = EXCLUDED.demissao,
         data_atestado = EXCLUDED.data_atestado,
         proximo_aso = EXCLUDED.proximo_aso,
         mes_ultimo_aso = EXCLUDED.mes_ultimo_aso,
         tipo_aso = EXCLUDED.tipo_aso,
         periodicidade = EXCLUDED.periodicidade,
         status_aso = EXCLUDED.status_aso,
         nome_medico = EXCLUDED.nome_medico,
         inicio_afastamento = EXCLUDED.inicio_afastamento,
         fim_afastamento = EXCLUDED.fim_afastamento,
         celular = EXCLUDED.celular,
         last_batch_id = EXCLUDED.last_batch_id,
         updated_at = now();
     END;
     $$ LANGUAGE plpgsql`,`CREATE OR REPLACE VIEW stg_alterdata_v2_compat AS
     SELECT
       cpf::text AS cpf,
       matricula::text AS matricula,
       COALESCE(colaborador,'') AS colaborador,
       COALESCE(funcao,'') AS funcao,
       COALESCE(unidade_hospitalar,'') AS unidade_hospitalar,
       CASE
         WHEN admissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(admissao,'YYYY-MM-DD')
         WHEN admissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(admissao,'DD/MM/YYYY')
         ELSE NULL
       END AS admissao,
       CASE
         WHEN demissao ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN to_date(demissao,'YYYY-MM-DD')
         WHEN demissao ~ '^\\d{2}/\\d{2}/\\d{4}$' THEN to_date(demissao,'DD/MM/YYYY')
         ELSE NULL
       END AS demissao,
       last_batch_id, updated_at
     FROM stg_alterdata_v2`])await n.Z.$executeRawUnsafe(a)}async function T(a){try{let{email:t}=await p(),o=await a.formData(),d=o.get("file");if(!d)return s.NextResponse.json({ok:!1,error:"Envie um arquivo .xlsx ou .csv"},{status:400});let r="true"===o.get("clearBeforeImport"),i=(d.name||"alterdata").toLowerCase(),m=Buffer.from(await d.arrayBuffer());await u(),r&&(console.log("[alterdata/import] Limpando tabelas antes de importar..."),await n.Z.$executeRawUnsafe("TRUNCATE TABLE stg_alterdata_v2_imports CASCADE"),await n.Z.$executeRawUnsafe("TRUNCATE TABLE stg_alterdata_v2_raw CASCADE"),await n.Z.$executeRawUnsafe("TRUNCATE TABLE stg_alterdata_v2 CASCADE"),console.log("[alterdata/import] Tabelas limpas com sucesso"));let c=[];if(i.endsWith(".xlsx"))try{let a=await e.e(1063).then(e.bind(e,81063)),t=a.read(m,{type:"buffer"}),o=t.Sheets[t.SheetNames[0]];c=a.utils.sheet_to_json(o,{defval:""})}catch(a){return s.NextResponse.json({ok:!1,error:'Para .xlsx \xe9 preciso ter a depend\xeancia "xlsx". Salve como CSV UTF-8 e tente novamente.'},{status:400})}else{let a=m.toString("utf8");c=function(a){let t=a.split(/\r?\n/).filter(a=>a.length>0);if(0===t.length)return{headers:[],rows:[]};let e=a=>{let t=[],e="",o=!1;for(let d=0;d<a.length;d++){let r=a[d];'"'===r?o&&'"'===a[d+1]?(e+='"',d++):o=!o:","!==r||o?e+=r:(t.push(e),e="")}return t.push(e),t},o=e(t[0]).map(a=>a.trim()),d=t.slice(1).map(a=>{let t=e(a),d={};return o.forEach((a,e)=>{d[a]=(t[e]??"").trim()}),d});return{headers:o,rows:d}}(a).rows}if(!c.length)return s.NextResponse.json({ok:!1,error:"Arquivo vazio"},{status:400});let _=(0,E.randomUUID)(),T=d.name||"upload",f=t||"admin",C=0;for(let a=0;a<c.length;a+=800){let t=c.slice(a,a+800),e=t.map((t,e)=>{let o=a+e+1,d=JSON.stringify(t).replace(/'/g,"''");return`('${_}'::uuid, ${o}, '${d}'::jsonb, '${T}', '${f}')`}).join(",\n"),o=`INSERT INTO stg_alterdata_v2_raw (batch_id, row_no, data, source_file, imported_by) VALUES ${e}`;await n.Z.$executeRawUnsafe(o),C+=t.length}await n.Z.$executeRawUnsafe(`
      INSERT INTO stg_alterdata_v2_imports (batch_id, source_file, total_rows, imported_by)
      VALUES ('${_}'::uuid, '${T}', ${C}, '${f}')
      ON CONFLICT (batch_id) DO NOTHING
    `),await n.Z.$executeRawUnsafe(`SELECT apply_alterdata_v2_batch('${_}'::uuid)`);try{await n.Z.$executeRawUnsafe(`
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_alterdata_v2_raw_flat;
    ANALYZE mv_alterdata_v2_raw_flat;
  `)}catch(a){console.log("View materializada ainda n\xe3o existe, ser\xe1 criada na pr\xf3xima vez")}try{await n.Z.auditLog.create({data:{actorId:f,action:"alterdata_import",entity:"stg_alterdata_v2",entityId:_,diff:{source:T,totalRows:C}}})}catch(a){console.error("[alterdata/import] failed to write AuditLog",a)}return s.NextResponse.json(function(a){for(var t=1;t<arguments.length;t++){var e=null!=arguments[t]?arguments[t]:{};t%2?l(Object(e),!0).forEach(function(t){var o,d;o=t,d=e[t],(o=function(a){var t=function(a,t){if("object"!=typeof a||null===a)return a;var e=a[Symbol.toPrimitive];if(void 0!==e){var o=e.call(a,t||"default");if("object"!=typeof o)return o;throw TypeError("@@toPrimitive must return a primitive value.")}return("string"===t?String:Number)(a)}(a,"string");return"symbol"==typeof t?t:String(t)}(o))in a?Object.defineProperty(a,o,{value:d,enumerable:!0,configurable:!0,writable:!0}):a[o]=d}):Object.getOwnPropertyDescriptors?Object.defineProperties(a,Object.getOwnPropertyDescriptors(e)):l(Object(e)).forEach(function(t){Object.defineProperty(a,t,Object.getOwnPropertyDescriptor(e,t))})}return a}({ok:!0,batchId:_,total_rows:C},r&&{cleared:!0,message:"Base limpa e dados da planilha importados com sucesso."}))}catch(a){return console.error("[alterdata/import] error",a),s.NextResponse.json({ok:!1,error:String(a?.message||a)},{status:500})}}let f=new d.AppRouteRouteModule({definition:{kind:r.x.APP_ROUTE,page:"/api/alterdata/import/route",pathname:"/api/alterdata/import",filename:"route",bundlePath:"app/api/alterdata/import/route"},resolvedPagePath:"/home/user/GGSSMA_RESULTADOS/app/api/alterdata/import/route.ts",nextConfigOutput:"",userland:o}),{requestAsyncStorage:C,staticGenerationAsyncStorage:L,serverHooks:N}=f,A="/api/alterdata/import/route";function S(){return(0,i.patchFetch)({serverHooks:N,staticGenerationAsyncStorage:L})}},27191:(a,t,e)=>{e.d(t,{Z:()=>d});var o=e(53524);let d=globalThis.prisma??new o.PrismaClient({log:["error"]})},87916:(a,t,e)=>{a.exports=e(30517)}};var t=require("../../../../webpack-runtime.js");t.C(a);var e=a=>t(t.s=a),o=t.X(0,[2035,4389,6236,9900],()=>e(58792));module.exports=o})();