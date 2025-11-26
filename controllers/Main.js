export default class Main {
  state = {
    options: {},
    threads: [],
    tmp: {},
    get displayedThreads() { return [] }
  }

  actions = {
    init: async () => {
      this.state.options = JSON.parse(localStorage.getItem('subgpt:options') || 'null') || {
        model: 'xai:grok-4-1-fast-non-reasoning',
        filter: [],
        autotag: true,
      };
      this.state.threads = JSON.parse(localStorage.getItem('subgpt:threads') || '[]');
      await post('main.persist');
      this.state.tmp.panel = this.state.options.oaiKey || this.state.options.xaiKey ? 'threads' : 'settings';
    },
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
    persist: () => {
      localStorage.setItem('subgpt:options', JSON.stringify(this.state.options));
      localStorage.setItem('subgpt:threads', JSON.stringify(this.state.threads));
    },
  };
}
