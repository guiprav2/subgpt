import complete from '../other/complete.js';
import { marked } from 'https://esm.sh/marked';

globalThis.markdown = x => marked.parse(x);

export default class Main {
  state = {
    options: {},
    models: [],
    get tags() { return [...new Set(this.threads.flatMap(x => x.tags || []))] },
    threads: [],
    tmp: {},
    get displayedThreads() {
      let ret = [];
      if (this.tmp.panel === 'threads') ret = this.threads.filter(x => !x.archived);
      if (this.tmp.panel === 'archives') ret = this.threads.filter(x => x.archived);
      ret = ret.filter(x => !this.options.filter?.length || (x.tags?.length && this.options.filter.every(y => x.tags.find(z => z.toLowerCase() === y.toLowerCase()))));
      if (!this.options.showErotica) ret = ret.filter(x => !x.tags?.includes?.('erotica'));
      return ret;
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
    toggleTagInput: () => this.state.tmp.showTagInput = !this.state.tmp.showTagInput,
    filterKeyUp: async ev => {
      if (ev.key === 'Escape') {
        ev.target.value = '';
        ev.target.blur();
        this.state.tmp.tagSuggestions = [];
        !this.state.options.filter.length && (this.state.tmp.showFilter = false);
        return;
      }
      let x = ev.target.value.trim();
      if (ev.key === 'Enter') {
        if (!x) { this.state.tagSuggestions = this.state.tags; return }
        await post('main.filter', x);
        return;
      }
      this.state.tmp.tagSuggestions = this.state.tags.filter(y => y.toLowerCase().includes(x.toLowerCase()) && this.state.options.filter.indexOf(y) === -1);
    },
    filter: async x => {
      if (!this.state.tags.includes(x) || this.state.options.filter.includes(x)) return;
      this.state.tmp.tagSuggestions = [];
      document.querySelector('#taginput').value = '';
      this.state.options.filter.push(x);
      await post('main.persist');
    },
    rmFilter: async x => {
      let input = document.querySelector('#taginput');
      input && (input.value = '');
      this.state.showFilterInput = false;
      this.state.options.filter = this.state.options.filter.filter(y => y !== x);
      !this.state.options.filter.length && (this.state.showFilter = false);
      await post('main.persist');
    },
    tagKeyUp: async ev => {
      if (ev.key === 'Escape') return await post('main.toggleTagInput');
      if (ev.key !== 'Enter') {
        this.state.tmp.tagSuggestions = ev.target.value.trim() ? this.state.tags.filter(x => x.toLowerCase().includes(ev.target.value.trim().toLowerCase())) : [];
        return;
      }
      await post('main.addTag', ev.target.value);
      ev.target.value = '';
    },
    addTag: async x => {
      let { thread } = this.state;
      thread.tags ??= [];
      thread.tags.push(x);
      await post('main.persist');
    },
    rmTag: async x => {
      let { thread } = this.state;
      let i = thread.tags.indexOf(x);
      i >= 0 && thread.tags.splice(i, 1);
      await post('main.persist');
    },
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
      if (msg.trim() === '/play') return showModal('GameModeDialog');
      thread.logs ??= [];
      thread.logs.push({ role: 'user', content: msg });
      d.update();
      await post('main.complete');
    },
    complete: async () => {
      let { thread } = this.state;
      this.state.tmp.threads ??= new Map();
      if (!this.state.tmp.threads.get(thread)) this.state.tmp.threads.set(thread, {});
      let threadtmp = this.state.tmp.threads.get(thread);
      if (threadtmp.busy) throw new Error(`Thread busy`);
      try {
        threadtmp.busy = true;
        d.update();
        let logs = !this.state.options.unary ? [...this.state.displayedLogs] : [{ role: 'user', content: this.state.displayedLogs.map(x => x.content).join('\n\n') }];
        for (let x of thread.tags?.filter?.(x => x.startsWith('pull:')) || []) {
          let prime = this.state.threads.filter(y => !y.archived && y.tags?.includes?.(x.slice('pull:'.length)));
          logs.unshift(...prime.flatMap(x => x.logs));
        }
        let apiKey = this.state.options.model.startsWith('oai:') ? this.state.options.oaiKey : this.state.options.xaiKey;
        let res = await complete(logs, { simple: true, model: this.state.options.model, apiKey });
        thread.logs.push(res);
        if (thread.logs.length <= 2) {
          threadtmp.busy = false;
          !thread.name && await post('main.suggestThreadName');
          this.state.options.autotag && await post('main.suggestThreadTags');
        }
        if (!this.state.threads.includes(thread)) this.state.threads.unshift(thread);
        await post('main.persist');
      } finally {
        threadtmp.busy = false;
      }
    },
    suggestThreadName: async () => {
      let { thread } = this.state;
      this.state.tmp.threads ??= new Map();
      if (!this.state.tmp.threads.get(thread)) this.state.tmp.threads.set(thread, {});
      let threadtmp = this.state.tmp.threads.get(thread);
      if (threadtmp.busy) throw new Error(`Thread busy`);
      try {
        threadtmp.busy = true;
        d.update();
        let apiKey = this.state.options.model.startsWith('oai:') ? this.state.options.oaiKey : this.state.options.xaiKey;
        let res = await complete(
          [...this.state.displayedLogs, { role: 'user', content: `Suggest a short name for this thread. Respond with the bare name, nothing else.` }],
          { simple: true, model: this.state.options.model, apiKey },
        );
        thread.name = res.content;
        await post('main.persist');
      } finally {
        threadtmp.busy = false;
      }
    },
    suggestThreadTags: async () => {
      let { thread } = this.state;
      this.state.tmp.threads ??= new Map();
      if (!this.state.tmp.threads.get(thread)) this.state.tmp.threads.set(thread, {});
      let threadtmp = this.state.tmp.threads.get(thread);
      if (threadtmp.busy) throw new Error(`Thread busy`);
      try {
        threadtmp.busy = true;
        d.update();
        let apiKey = this.state.options.model.startsWith('oai:') ? this.state.options.oaiKey : this.state.options.xaiKey;
        let addRes = await complete(
          [...this.state.displayedLogs, {
            role: 'user',
            content: [
              `Suggest a comprehensive comma-separated list of tags ONLY for things mentioned in this thread.`,
              thread.tags?.length && `This is the current tag list: ${thread.tags.join(', ')}.`,
              `Don't repeat existiing tags.`,
              `If this is sexually charged, make sure to include the tag "erotica" FIRST.`,
              `Respond with the bare tags, nothing else.`,
              `If the existing list of tags captures everything, respond with a bare "[NONE]".`,
            ],
          }],
          { simple: true, model: this.state.options.model, apiKey },
        );
        console.log('addRes:', addRes.content);
        if (!addRes.content.includes('[NONE]')) {
          thread.tags ??= [];
          for (let x of addRes.content.split(',').map(x => x.trim().toLowerCase().replaceAll(/[ _]+/g, '-'))) !thread.tags.includes(x) && thread.tags.push(x);
        }
        d.update();
        /* FIXME:
        if (!thread.tags.length) return;
        let rmRes = await complete(
          [...this.state.displayedLogs, {
            role: 'user',
            content: [
              `Suggest a comprehensive comma-separated list of the following tags irrelevant to this thread (e.g. not explicitly mentioned anywhere outside the following list): ${thread.tags.join(', ')}`,
              `Respond with the bare tags, nothing else.`,
              `Only if all tags are relevant, respond with a bare "[NONE]".`,
            ],
          }],
          { simple: true, model: 'xai:grok-4-1-fast-reasoning', apiKey },
        );
        console.log('rmRes:', rmRes.content);
        if (!rmRes.content.includes('[NONE]')) {
          for (let x of rmRes.content.split(',').map(x => x.trim().toLowerCase().replaceAll(/[ _]+/g, '-'))) {
            let i = thread.tags.indexOf(x);
            i >= 0 && thread.tags.splice(i, 1);
          }
        }
        */
      } finally {
        await post('main.persist');
        threadtmp.busy = false;
      }
    },
    editLog: x => {
      let { thread } = this.state;
      this.state.tmp.threads ??= new Map();
      if (!this.state.tmp.threads.get(thread)) this.state.tmp.threads.set(thread, {});
      let threadtmp = this.state.tmp.threads.get(thread);
      threadtmp.editing = x;
      threadtmp.editingContent = x.content;
      console.log(threadtmp);
    },
    saveLog: async x => {
      let { thread } = this.state;
      let threadtmp = this.state.tmp.threads.get(thread);
      x.content = threadtmp.editingContent;
      delete threadtmp.editing;
      delete threadtmp.editingContent;
      await post('main.persist');
    },
    revertLog: async x => {
      let { thread } = this.state;
      let threadtmp = this.state.tmp.threads.get(thread);
      delete threadtmp.editing;
      delete threadtmp.editingContent;
    },
    rmLog: async x => {
      let { thread } = this.state;
      let i = thread.logs.indexOf(x);
      i >= 0 && thread.logs.splice(i, 1);
      await post('main.persist');
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
      if (this.state.thread === x) this.state.thread = null;
      await post('main.persist');
    },
    persist: () => {
      localStorage.setItem('subgpt:options', JSON.stringify(this.state.options));
      localStorage.setItem('subgpt:threads', JSON.stringify(this.state.threads));
    },
  };
}
