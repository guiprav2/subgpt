import complete from '../other/complete.js';
import { marked } from 'https://esm.sh/marked';

globalThis.markdown = x => marked.parse(x);

export default class Main {
  state = {
    options: {},
    models: [],
    get tags() { return [...new Set(...this.threads.flatMap(x => x.tags || []))] },
    threads: [],
    tmp: {},
    get displayedThreads() {
      if (this.tmp.panel === 'threads') return this.threads.filter(x => !x.archived);
      if (this.tmp.panel === 'archives') return this.threads.filter(x => x.archived);
      return [];
    },
    get displayedLogs() { return this.thread?.logs || [] },
  }
  actions = {
    init: async () => {
      this.state.options = JSON.parse(localStorage.getItem('subgpt:options') || 'null') || { model: 'xai:grok-4-1-fast-non-reasoning', filter: [], autotag: true };
      this.state.threads = JSON.parse(localStorage.getItem('subgpt:threads') || '[]');
      await post('main.persist');
      this.state.tmp.panel = this.state.options.oaiKey || this.state.options.xaiKey ? 'threads' : 'settings';
    },
    newThread: () => this.state.thread = {},
    openThread: x => this.state.thread = x,
    cloneThread: () => alert(),
    toggleShowFilter: () => this.state.tmp.showFilter = !this.state.tmp.showFilter,
    toggleFilterInput: () => this.state.tmp.showFilterInput = !this.state.tmp.showFilterInput,
    toggleArchives: (ev, x) => {
      if (x != null) return this.state.tmp.panel = x ? 'archives' : 'threads';
      if (this.state.tmp.panel !== 'archives') this.state.tmp.panel = 'archives';
      else this.state.tmp.panel = 'threads';
    },
    toggleSettings: (ev, x) => {
      if (!this.state.options.oaiKey && !this.state.options.xaiKey) return this.state.tmp.panel = 'settings';
      if (x != null) return this.state.tmp.panel = x ? 'settings' : 'threads';
      if (this.state.tmp.panel !== 'settings') this.state.tmp.panel = 'settings';
      else this.state.tmp.panel = 'threads';
    },
    toggleAutoTagging: async ev => { this.state.options.autotag = ev.target.value; await post('main.persist') },
    toggleUnaryMessaging: async ev => { this.state.options.unary = ev.target.value; await post('main.persist') },
    toggleShowErotica: async ev => { this.state.options.showErotica = ev.target.value; await post('main.persist') },
    toggleErotica: async ev => { this.state.options.erotica = ev.target.value; await post('main.persist') },
    toggleRoleMapping: async ev => { this.state.options.rolemap = ev.target.value; await post('main.persist') },
    msgKeyDown: ev => ev.key === 'Enter' && !ev.shiftKey && ev.preventDefault(),
    msgKeyUp: async ev => {
      if (ev.key !== 'Enter' || ev.shiftKey) return;
      let { thread } = this.state;
      this.state.tmp.threads ??= new Map();
      if (!this.state.tmp.threads.get(thread)) this.state.tmp.threads.set(thread, {});
      let threadtmp = this.state.tmp.threads.get(thread);
      if (threadtmp.busy) return;
      let msg = ev.target.value.trim();
      ev.target.value = '';
      thread.logs ??= [];
      thread.logs.push({ role: 'user', content: msg });
      d.update();
      await post('main.complete');
    },
    complete: async (logs = this.state.displayedLogs) => {
      let { thread } = this.state;
      this.state.tmp.threads ??= new Map();
      if (!this.state.tmp.threads.get(thread)) this.state.tmp.threads.set(thread, {});
      let threadtmp = this.state.tmp.threads.get(thread);
      if (threadtmp.busy) throw new Error(`Thread busy`);
      try {
        threadtmp.busy = true;
        d.update();
        let apiKey = this.state.options.model.startsWith('oai:') ? this.state.options.oaiKey : this.state.options.xaiKey;
        let res = await complete(logs, { simple: true, model: this.state.options.model, apiKey });
        thread.logs.push(res);
        if (!this.state.threads.includes(thread)) this.state.threads.unshift(thread);
        await post('main.persist');
      } finally {
        threadtmp.busy = false;
      }
    },
    toggleArchived: async (ev, x) => {
      ev?.stopPropagation?.();
      x.archived = !x.archived;
      await post('main.persist');
    },
    rm: async (ev, x) => {
      ev?.stopPropagation?.();
      let i = this.state.threads.indexOf(x);
      i >= 0 && this.state.threads.splice(i, 1);
      await post('main.persist');
    },
    persist: () => {
      localStorage.setItem('subgpt:options', JSON.stringify(this.state.options));
      localStorage.setItem('subgpt:threads', JSON.stringify(this.state.threads));
    },
  };
}
