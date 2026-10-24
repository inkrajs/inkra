// Rebuild from validated current inputs, not historical report-specific conclusions.
import { writeFile, mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { loadMetricInputs, validateComponentMetrics } from './validate-component-metrics.mjs';
import { pathToFileURL } from 'node:url';

function reportHtml(lines) {
  const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const body = [];
  let table = false;
  for (const line of lines) {
    if (line.startsWith('|')) {
      if (/^\|[-:| ]+\|$/.test(line)) continue;
      const heading = !table;
      if (heading) { body.push('<div class="table-wrap"><table>'); table = true; }
      const cell = heading ? 'th' : 'td';
      body.push(`<tr>${line.slice(1, -1).split('|').map(value => `<${cell}>${escape(value.trim())}</${cell}>`).join('')}</tr>`);
      continue;
    }
    if (table) { body.push('</table></div>'); table = false; }
    if (!line) continue;
    if (line.startsWith('## ')) body.push(`<h2>${escape(line.slice(3))}</h2>`);
    else if (line.startsWith('# ')) body.push(`<h1>${escape(line.slice(2))}</h1>`);
    else body.push(`<p>${escape(line)}</p>`);
  }
  if (table) body.push('</table></div>');
  return `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inkra 组件性能指标</title><style>body{margin:0;background:#f5f3ee;color:#23352e;font:16px/1.75 system-ui,sans-serif}main{max-width:1120px;margin:40px auto;padding:36px;background:#fff;border-radius:16px}h1{font-size:32px;line-height:1.25}h2{margin-top:36px;padding-top:20px;border-top:2px solid #e3ebe5}p{overflow-wrap:anywhere}.table-wrap{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:14px}th,td{text-align:left;padding:12px;border-bottom:1px solid #e3ebe5}th{background:#eef3ef}header{font-size:13px;color:#53695c;letter-spacing:.08em}@media(max-width:650px){main{margin:0;padding:20px;border-radius:0}h1{font-size:26px}}@media print{main{margin:0;padding:0}h2{break-after:avoid}tr{break-inside:avoid}}</style><main><header>INKRA / PERFORMANCE EVIDENCE</header>${body.join('\n')}</main></html>\n`;
}

export async function writeComponentMetricReport(inputs, output = process.env.REPORT_OUTPUT || '.local/performance-report') {
const validation = validateComponentMetrics(inputs);
const { runtime, large, bundles } = inputs;
await mkdir(output,{recursive:true});
const csv=rows=>rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\n')+'\n';
const f=value=>typeof value==='number'?value.toFixed(2):'—';
const bundleMap=new Map(bundles.results.map(b=>[b.id,b]));
const components=runtime.coverage.map(c=>{
  assert(bundleMap.has(c.component));const evidence=runtime.results.filter(r=>r.covers.includes(c.component));
  const expected=evidence.filter(r=>r.size!==undefined);const valid=expected.filter(r=>r.status==='measured'&&(r.mode==='ssr'?r.ssrVerified:r.observedIdentities?.[c.component]?.mountedInstances>0));
  const representative=[...valid].sort((a,b)=>b.size-a.size)[0];
  return {...c,representative:representative?{fixture:representative.id,size:representative.size,mode:representative.mode,phases:representative.phases,hostNodes:representative.hostNodes,heapDeltaAfterWarmupGc:representative.heapDeltaAfterWarmupGc}:null,bundle:bundleMap.get(c.component).totals,allAttemptedScalesMeasured:expected.length>0&&valid.length===expected.length&&!evidence.some(r=>r.status==='blocked'),scaleResults:expected.map(r=>({fixture:r.id,size:r.size,status:r.status,identityObserved:r.mode==='ssr'?r.ssrVerified:Boolean(r.observedIdentities?.[c.component]?.mountedInstances)})),limitations:evidence.filter(r=>r.reason).map(r=>r.reason),fixtureNotes:[...new Set(evidence.map(r=>r.notes).filter(Boolean))]};
});
const merged={schemaVersion:2,sourceTree:runtime.sourceTree,provenance:{scope:'Current supplied metric artifacts validated against current public API and inventory; not a retroactive extension of historical measurements.',comparison:'No paired baseline supplied; no performance improvement or previous report conclusion inferred.'},validation,summary:{...runtime.summary,allAttemptedScalesMeasured:components.filter(c=>c.allAttemptedScalesMeasured).length,bundleMeasured:validation.bundleIdentitiesMeasured,largeDataScenarios:large.results.length,largeDataCompleted:large.results.filter(r=>r.status==='ok').length},components};
await writeFile(`${output}/component-metrics.json`,JSON.stringify(merged,null,2));
const componentRows=[['component','aliases','source','runtime_status','all_attempted_scales_measured','measured_scales','mode','shared_fixture_ids','standalone_consumer_raw_bytes','standalone_consumer_gzip_bytes','own_module_raw_bytes','own_module_gzip_bytes','representative_fixture','representative_scale','shared_mount_wall_median_ms','shared_same_value_recreated_wall_median_ms','shared_changed_wall_median_ms','shared_unmount_wall_median_ms','shared_mount_react_duration_median_ms','shared_changed_react_duration_median_ms','shared_renderer_host_nodes','shared_ssr_fresh_median_ms','shared_ssr_same_median_ms','shared_ssr_changed_median_ms','shared_ssr_html_bytes','node_post_unmount_gc_heap_drift_bytes','gaps','fixture_notes']];
for(const c of components)componentRows.push([c.component,c.aliases.join(';'),c.source,c.status,c.allAttemptedScalesMeasured,[...new Set(c.evidence.map(e=>e.size))].join(';'),[...new Set(c.evidence.map(e=>e.mode))].join(';'),[...new Set(c.evidence.map(e=>e.fixture))].join(';'),c.bundle.rawBytes,c.bundle.gzipBytes,c.moduleBytes?.rawBytes,c.moduleBytes?.gzipBytes,c.representative?.fixture,c.representative?.size,c.representative?.phases.mount?.wallTimeMs.median,c.representative?.phases.sameValueRecreatedFixture?.wallTimeMs.median,c.representative?.phases.changed?.wallTimeMs.median,c.representative?.phases.unmount?.wallTimeMs.median,c.representative?.phases.mount?.reactActualDurationMs?.median,c.representative?.phases.changed?.reactActualDurationMs?.median,c.representative?.hostNodes?.all?.median,c.representative?.phases.ssrFresh?.wallTimeMs.median,c.representative?.phases.ssrSameInputs?.wallTimeMs.median,c.representative?.phases.ssrChangedInputs?.wallTimeMs.median,c.representative?.phases.ssrFresh?.htmlBytes?.median,c.representative?.heapDeltaAfterWarmupGc,c.limitations.join('; '),c.fixtureNotes.join(' | ')]);
await writeFile(`${output}/component-metrics.csv`,'\ufeff'+csv(componentRows));
const detail=[['shared_fixture','component_ids','size','mode','phase','n','wall_median_ms','wall_min_ms','wall_max_ms','wall_stddev_ms','react_actual_duration_median_ms','commit_count_median','renderer_host_nodes','html_bytes','node_heap_after_unmount_gc_last_bytes','note']];
for(const r of runtime.results)if(r.status==='measured')for(const [phase,v]of Object.entries(r.phases))detail.push([r.id,r.covers.join(';'),r.size,r.mode,phase,v.wallTimeMs.n,v.wallTimeMs.median,v.wallTimeMs.min,v.wallTimeMs.max,v.wallTimeMs.stddev,v.reactActualDurationMs?.median,v.commitCount?.median,r.hostNodes?.all?.median,v.htmlBytes?.median,r.heapAfterUnmountGc?.at(-1),r.notes]);
await writeFile(`${output}/runtime-metrics.csv`,'\ufeff'+csv(detail));
const largeRows=[['scenario','input_size','status','mode','phase','n','median_ms','min_ms','max_ms','stddev_ms','renderer_host_nodes','shape','failure']];
for(const r of large.results){if(r.status!=='ok'){largeRows.push([r.name,r.size,r.status,'','','','','','','','',JSON.stringify(r.shape||''),r.reason]);continue;}for(const [phase,v]of Object.entries(r.phases||{operation:r.operation}))largeRows.push([r.name,r.size,r.status,r.mode,phase,v.samplesMs.length,v.medianMs,v.minMs,v.maxMs,v.stddevMs,r.hostNodeCounts?.[0],typeof r.shape==='string'?r.shape:JSON.stringify(r.shape),'']);}
await writeFile(`${output}/large-data-metrics.csv`,'\ufeff'+csv(largeRows));
const blocks=components.filter(c=>c.status!=='measured-shared-fixture');
const topBundle=[...components].sort((a,b)=>b.bundle.gzipBytes-a.bundle.gzipBytes).slice(0,12);
const text=value=>value??'未记录';
const runtimeSizes=[...new Set(runtime.results.map(r=>r.size).filter(size=>size!==undefined))].sort((a,b)=>a-b);
const largeSizes=[...new Set(large.results.map(r=>r.size))].sort((a,b)=>a-b);
const viteVersions=[...new Set(bundles.results.map(r=>r.vite).filter(Boolean))];
const lines=[
'# Inkra 当前输入的组件性能指标', '',
'## 来源与覆盖',
`输入指标源码树：${runtime.sourceTree}。本报告按当前公开API与清单验证输入文件，不把历史报告当成此次复测，也不自动沿用历史优化结论、测试数量、浏览器阻塞原因或发布状态。没有提供成对基线，不能仅凭本报告声称性能提升。`,
`当前清单含${validation.componentIdentities}个独立组件身份、${validation.verifiedAliasPaths}条别名路径；${validation.topLevelRuntimeExportsIncludingNonComponents}个顶层运行时导出还包括函数、常量和hooks，不等于组件数。独立consumer包体取得${validation.bundleIdentitiesMeasured}个身份的证据；运行时/SSR取得${validation.runtimeIdentityCount}个身份的至少一个适用场景证据，${blocks.length}个身份尚无成功运行时证据。`,
`${merged.summary.allAttemptedScalesMeasured}个身份在全部已尝试规模上取得证据；这不是未记录规模的通过证明。运行时覆盖口径：${validation.runtimeCoverageBasis}。大数据记录${validation.largeDataCases}个案例，${validation.largeDataSuccessful}个完成；覆盖口径：${validation.largeDataCoverageBasis}。`,
'共享fixture总耗时不能拆分或冒充每个子组件独占成本。新增组件必须有自身输入证据，不能归入它尚不存在时的历史报告。', '',
'## 记录的环境与方法',
`Node ${text(runtime.environment?.node)}；React ${text(runtime.environment?.react)}；renderer ${text(runtime.environment?.renderer)}；模式 ${text(runtime.environment?.mode)}；${text(runtime.environment?.os??runtime.environment?.platform)}/${text(runtime.environment?.arch)}；CPU ${text(runtime.environment?.cpu)}。`,
`运行时：${runtime.method.repetitions}次重复，预热${text(runtime.method.warmup)}次；串行=${text(runtime.method.serial)}；超时${text(runtime.method.timeoutMs)}ms；old-space上限${text(runtime.method.maxOldSpaceMiB)}MiB；实际记录规模=${runtimeSizes.join('/')}。大数据：${large.method.repetitions}次重复，预热${text(large.method.warmupRuns)}次；超时${text(large.method.perCaseTimeoutMs)}ms；old-space上限${text(large.method.nodeMaxOldSpaceMiB)}MiB；实际记录规模=${largeSizes.join('/')}。`,
`运行时fixture构造口径：${text(runtime.method.fixtureCreation)}。相同值更新口径：${text(runtime.method.sameValueUpdate)}。大数据计时口径：${text(large.method.timingIncludes)}。`,
'原始样本用于核对重复数和离散程度，不能据此推断线上p95或浏览器输入延迟。不同模式、规模、数据形状和设备不可直接换算。',
'React Profiler actualDuration包含子树render，不是DOM提交、layout或paint；commitTime是时间戳。卸载只报告wall time。宿主节点来自test-renderer，不是真实DOM；SSR不包括effect、交互或hydrate。Node RSS/GC heap包含运行时、fixture和缓存，不是组件独占内存或泄漏证明。', '',
'## 大数据组件记录（ms，中位数）',
'数据形状、可见窗口和分页由每条原始记录的shape、fixtureCounts及missingBrowserCoverage解释，不沿用其他运行的假设。', '',
'| 场景 | 请求规模 | 记录的实际输入数 | mount | 相同引用更新 | 单项变更 | 宿主节点 |',
'|---|---:|---:|---:|---:|---:|---:|',
];
for(const r of large.results.filter(r=>r.status==='ok'&&r.phases))lines.push(`| ${r.name} | ${r.size} | ${r.shape?.componentInputRecords??'未单独记录'} | ${f(r.phases.mount.medianMs)} | ${f(r.phases.unchanged.medianMs)} | ${f(r.phases.oneItemChange.medianMs)} | ${r.hostNodeCounts?.[0]??'未记录'} |`);
lines.push('','### 纯模型操作（不包含组件挂载）','','| 模型操作 | 请求规模 | 中位数ms | 记录的输出计数 |','|---|---:|---:|---:|');
for(const r of large.results.filter(r=>r.status==='ok'&&r.operation))lines.push(`| ${r.name} | ${r.size} | ${f(r.operation.medianMs)} | ${r.outputCount??'未记录'} |`);
lines.push('','### 失败、超时与未完成记录','子进程超时和人为设置的Node内存上限不是浏览器崩溃诊断。失败记录保留在原始JSON中，不计为成功。');
const largeFailures=large.results.filter(r=>r.status!=='ok');
for(const r of largeFailures)lines.push(`- ${r.name}，N=${r.size}：${r.status}；${r.reason}`);
if(!largeFailures.length)lines.push('- 已记录的大数据案例没有失败；不代表未记录的场景已通过。');
lines.push('','## 独立consumer生产包体',
`记录的Vite版本：${viteVersions.join(', ')||'未记录'}；minifier=${text(bundles.method?.minifier)}；target=${text(bundles.method?.target)}。peer externals=${(bundles.method?.peerExternals??[]).join(', ')||'未记录'}。`,
`体积口径：${text(bundles.method?.attribution)}。chunk口径：${text(bundles.method?.closure)}。CSS口径：${text(bundles.method?.css)}。`,
'不能把各组件独立consumer体积相加当成整库体积；bundle体积也不是实际页面下载、解析或执行耗时。',
`Tree-shaking对照：${bundles.treeShaking?.status==='measured'?`unused相对baseline raw增量=${bundles.treeShaking.unusedMinusBaselineRaw}，gzip增量=${bundles.treeShaking.unusedMinusBaselineGzip}字节；输出哈希相同=${bundles.treeShaking.identicalOutputHashes}`:`未取得有效对照（${bundles.treeShaking?.status??'未记录'}）`}。`);
for(const file of bundles.packageCss??[])lines.push(`- ${file.file}：${file.status==='unavailable'?file.reason:`${file.rawBytes} raw / ${file.gzipBytes} gzip字节`}。`);
lines.push('','| 规范导入身份 | raw bytes | gzip bytes |','|---|---:|---:|');
for(const c of topBundle)lines.push(`| ${c.component} | ${c.bundle.rawBytes} | ${c.bundle.gzipBytes} |`);
lines.push('','## 证据边界与后续验收',
'本模板不生成没有成对测量支持的优化优先级、收益百分比或根因结论。应先比较相同版本依赖、数据形状、场景与设备上的前后样本，再结合调用计数、源码和真实浏览器trace决定是否修改。',
'这些Node/SSR/构建记录不提供LCP、INP、CLS、layout/paint、真实DOM、滚动帧率或GPU证据。浏览器是否可用需要另行检查，不能引用历史环境阻塞作为当前事实。',
'真实页面验收应覆盖加载瀑布、JS解析执行、输入到呈现、长任务、键盘/读屏、反复打开关闭与卸载、heap retainer和资源清理。没有复现原始故障时，不宣称崩溃根因已解决。','','## 尚无成功运行时证据的身份');
for(const c of blocks)lines.push(`- ${c.component}：${c.limitations.join('；')||'真实导出身份未在成功的fixture中得到确认。'}`);
if(!blocks.length)lines.push('- 当前清单每个身份至少有一个成功场景；不代表所有规模或浏览器场景均通过。');
lines.push('',`另有${components.filter(c=>!c.allAttemptedScalesMeasured).length}个身份未在全部已尝试规模取得证据，详见component-metrics.json的scaleResults与limitations。`,'','## 文件与复现',
`- component-metrics.csv/json：${validation.componentIdentities}个当前身份的来源、别名、证据、规模、缺口与consumer包体。`,
'- runtime-metrics.csv：已测fixture/规模/阶段的统计；失败与阻塞保留在原始runtime JSON和逐身份JSON中。',
'- large-data-metrics.csv：当前输入中所有已尝试大数据案例，包括失败。',
'- validation.json：当前清单/API一致性、源码树一致性、证据完整性与样本数校验，不是性能预算或浏览器验收。',
'- 从已构建源码执行benchmark-all-components.mjs、benchmark-large-data.mjs与benchmark-component-bundles.mjs，保持相同源码树并保存原始JSON。所需依赖版本和运行参数应取自原始记录，不由报告模板固定。',
'- PERF_INVENTORY、PERF_RESULTS、LARGE_RESULTS、BUNDLE_RESULTS选择输入；REPORT_OUTPUT选择输出。执行node scripts/report-component-metrics.mjs会先执行完整一致性校验，拒绝缺失或混合源码树的数据。');
await writeFile(`${output}/REPORT.zh-CN.html`,reportHtml(lines));
await writeFile(`${output}/validation.json`,JSON.stringify({...validation,runtimeAllAttemptedScales:merged.summary.allAttemptedScalesMeasured},null,2));
return merged;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const merged = await writeComponentMetricReport(await loadMetricInputs());
  console.log(JSON.stringify(merged.summary));
}
