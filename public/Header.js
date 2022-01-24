var Header = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function is_promise(value) {
        return value && typeof value === 'object' && typeof value.then === 'function';
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    let src_url_equal_anchor;
    function src_url_equal(element_src, url) {
        if (!src_url_equal_anchor) {
            src_url_equal_anchor = document.createElement('a');
        }
        src_url_equal_anchor.href = url;
        return element_src === src_url_equal_anchor.href;
    }
    function not_equal(a, b) {
        return a != a ? b == b : a !== b;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function null_to_empty(value) {
        return value == null ? '' : value;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    // Track which nodes are claimed during hydration. Unclaimed nodes can then be removed from the DOM
    // at the end of hydration without touching the remaining nodes.
    let is_hydrating = false;
    function start_hydrating() {
        is_hydrating = true;
    }
    function end_hydrating() {
        is_hydrating = false;
    }
    function upper_bound(low, high, key, value) {
        // Return first index of value larger than input value in the range [low, high)
        while (low < high) {
            const mid = low + ((high - low) >> 1);
            if (key(mid) <= value) {
                low = mid + 1;
            }
            else {
                high = mid;
            }
        }
        return low;
    }
    function init_hydrate(target) {
        if (target.hydrate_init)
            return;
        target.hydrate_init = true;
        // We know that all children have claim_order values since the unclaimed have been detached if target is not <head>
        let children = target.childNodes;
        // If target is <head>, there may be children without claim_order
        if (target.nodeName === 'HEAD') {
            const myChildren = [];
            for (let i = 0; i < children.length; i++) {
                const node = children[i];
                if (node.claim_order !== undefined) {
                    myChildren.push(node);
                }
            }
            children = myChildren;
        }
        /*
        * Reorder claimed children optimally.
        * We can reorder claimed children optimally by finding the longest subsequence of
        * nodes that are already claimed in order and only moving the rest. The longest
        * subsequence subsequence of nodes that are claimed in order can be found by
        * computing the longest increasing subsequence of .claim_order values.
        *
        * This algorithm is optimal in generating the least amount of reorder operations
        * possible.
        *
        * Proof:
        * We know that, given a set of reordering operations, the nodes that do not move
        * always form an increasing subsequence, since they do not move among each other
        * meaning that they must be already ordered among each other. Thus, the maximal
        * set of nodes that do not move form a longest increasing subsequence.
        */
        // Compute longest increasing subsequence
        // m: subsequence length j => index k of smallest value that ends an increasing subsequence of length j
        const m = new Int32Array(children.length + 1);
        // Predecessor indices + 1
        const p = new Int32Array(children.length);
        m[0] = -1;
        let longest = 0;
        for (let i = 0; i < children.length; i++) {
            const current = children[i].claim_order;
            // Find the largest subsequence length such that it ends in a value less than our current value
            // upper_bound returns first greater value, so we subtract one
            // with fast path for when we are on the current longest subsequence
            const seqLen = ((longest > 0 && children[m[longest]].claim_order <= current) ? longest + 1 : upper_bound(1, longest, idx => children[m[idx]].claim_order, current)) - 1;
            p[i] = m[seqLen] + 1;
            const newLen = seqLen + 1;
            // We can guarantee that current is the smallest value. Otherwise, we would have generated a longer sequence.
            m[newLen] = i;
            longest = Math.max(newLen, longest);
        }
        // The longest increasing subsequence of nodes (initially reversed)
        const lis = [];
        // The rest of the nodes, nodes that will be moved
        const toMove = [];
        let last = children.length - 1;
        for (let cur = m[longest] + 1; cur != 0; cur = p[cur - 1]) {
            lis.push(children[cur - 1]);
            for (; last >= cur; last--) {
                toMove.push(children[last]);
            }
            last--;
        }
        for (; last >= 0; last--) {
            toMove.push(children[last]);
        }
        lis.reverse();
        // We sort the nodes being moved to guarantee that their insertion order matches the claim order
        toMove.sort((a, b) => a.claim_order - b.claim_order);
        // Finally, we move the nodes
        for (let i = 0, j = 0; i < toMove.length; i++) {
            while (j < lis.length && toMove[i].claim_order >= lis[j].claim_order) {
                j++;
            }
            const anchor = j < lis.length ? lis[j] : null;
            target.insertBefore(toMove[i], anchor);
        }
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function get_root_for_style(node) {
        if (!node)
            return document;
        const root = node.getRootNode ? node.getRootNode() : node.ownerDocument;
        if (root && root.host) {
            return root;
        }
        return node.ownerDocument;
    }
    function append_empty_stylesheet(node) {
        const style_element = element('style');
        append_stylesheet(get_root_for_style(node), style_element);
        return style_element;
    }
    function append_stylesheet(node, style) {
        append(node.head || node, style);
    }
    function append_hydration(target, node) {
        if (is_hydrating) {
            init_hydrate(target);
            if ((target.actual_end_child === undefined) || ((target.actual_end_child !== null) && (target.actual_end_child.parentElement !== target))) {
                target.actual_end_child = target.firstChild;
            }
            // Skip nodes of undefined ordering
            while ((target.actual_end_child !== null) && (target.actual_end_child.claim_order === undefined)) {
                target.actual_end_child = target.actual_end_child.nextSibling;
            }
            if (node !== target.actual_end_child) {
                // We only insert if the ordering of this node should be modified or the parent node is not target
                if (node.claim_order !== undefined || node.parentNode !== target) {
                    target.insertBefore(node, target.actual_end_child);
                }
            }
            else {
                target.actual_end_child = node.nextSibling;
            }
        }
        else if (node.parentNode !== target || node.nextSibling !== null) {
            target.appendChild(node);
        }
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function insert_hydration(target, node, anchor) {
        if (is_hydrating && !anchor) {
            append_hydration(target, node);
        }
        else if (node.parentNode !== target || node.nextSibling != anchor) {
            target.insertBefore(node, anchor || null);
        }
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function svg_element(name) {
        return document.createElementNS('http://www.w3.org/2000/svg', name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function init_claim_info(nodes) {
        if (nodes.claim_info === undefined) {
            nodes.claim_info = { last_index: 0, total_claimed: 0 };
        }
    }
    function claim_node(nodes, predicate, processNode, createNode, dontUpdateLastIndex = false) {
        // Try to find nodes in an order such that we lengthen the longest increasing subsequence
        init_claim_info(nodes);
        const resultNode = (() => {
            // We first try to find an element after the previous one
            for (let i = nodes.claim_info.last_index; i < nodes.length; i++) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    return node;
                }
            }
            // Otherwise, we try to find one before
            // We iterate in reverse so that we don't go too far back
            for (let i = nodes.claim_info.last_index - 1; i >= 0; i--) {
                const node = nodes[i];
                if (predicate(node)) {
                    const replacement = processNode(node);
                    if (replacement === undefined) {
                        nodes.splice(i, 1);
                    }
                    else {
                        nodes[i] = replacement;
                    }
                    if (!dontUpdateLastIndex) {
                        nodes.claim_info.last_index = i;
                    }
                    else if (replacement === undefined) {
                        // Since we spliced before the last_index, we decrease it
                        nodes.claim_info.last_index--;
                    }
                    return node;
                }
            }
            // If we can't find any matching node, we create a new one
            return createNode();
        })();
        resultNode.claim_order = nodes.claim_info.total_claimed;
        nodes.claim_info.total_claimed += 1;
        return resultNode;
    }
    function claim_element_base(nodes, name, attributes, create_element) {
        return claim_node(nodes, (node) => node.nodeName === name, (node) => {
            const remove = [];
            for (let j = 0; j < node.attributes.length; j++) {
                const attribute = node.attributes[j];
                if (!attributes[attribute.name]) {
                    remove.push(attribute.name);
                }
            }
            remove.forEach(v => node.removeAttribute(v));
            return undefined;
        }, () => create_element(name));
    }
    function claim_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, element);
    }
    function claim_svg_element(nodes, name, attributes) {
        return claim_element_base(nodes, name, attributes, svg_element);
    }
    function claim_text(nodes, data) {
        return claim_node(nodes, (node) => node.nodeType === 3, (node) => {
            const dataStr = '' + data;
            if (node.data.startsWith(dataStr)) {
                if (node.data.length !== dataStr.length) {
                    return node.splitText(dataStr.length);
                }
            }
            else {
                node.data = dataStr;
            }
        }, () => text(data), true // Text nodes should not update last index since it is likely not worth it to eliminate an increasing subsequence of actual elements
        );
    }
    function claim_space(nodes) {
        return claim_text(nodes, ' ');
    }
    function find_comment(nodes, text, start) {
        for (let i = start; i < nodes.length; i += 1) {
            const node = nodes[i];
            if (node.nodeType === 8 /* comment node */ && node.textContent.trim() === text) {
                return i;
            }
        }
        return nodes.length;
    }
    function claim_html_tag(nodes) {
        // find html opening tag
        const start_index = find_comment(nodes, 'HTML_TAG_START', 0);
        const end_index = find_comment(nodes, 'HTML_TAG_END', start_index);
        if (start_index === end_index) {
            return new HtmlTagHydration();
        }
        init_claim_info(nodes);
        const html_tag_nodes = nodes.splice(start_index, end_index + 1);
        detach(html_tag_nodes[0]);
        detach(html_tag_nodes[html_tag_nodes.length - 1]);
        const claimed_nodes = html_tag_nodes.slice(1, html_tag_nodes.length - 1);
        for (const n of claimed_nodes) {
            n.claim_order = nodes.claim_info.total_claimed;
            nodes.claim_info.total_claimed += 1;
        }
        return new HtmlTagHydration(claimed_nodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
    }
    class HtmlTag {
        constructor() {
            this.e = this.n = null;
        }
        c(html) {
            this.h(html);
        }
        m(html, target, anchor = null) {
            if (!this.e) {
                this.e = element(target.nodeName);
                this.t = target;
                this.c(html);
            }
            this.i(anchor);
        }
        h(html) {
            this.e.innerHTML = html;
            this.n = Array.from(this.e.childNodes);
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert(this.t, this.n[i], anchor);
            }
        }
        p(html) {
            this.d();
            this.h(html);
            this.i(this.a);
        }
        d() {
            this.n.forEach(detach);
        }
    }
    class HtmlTagHydration extends HtmlTag {
        constructor(claimed_nodes) {
            super();
            this.e = this.n = null;
            this.l = claimed_nodes;
        }
        c(html) {
            if (this.l) {
                this.n = this.l;
            }
            else {
                super.c(html);
            }
        }
        i(anchor) {
            for (let i = 0; i < this.n.length; i += 1) {
                insert_hydration(this.t, this.n[i], anchor);
            }
        }
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = get_root_for_style(node);
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = append_empty_stylesheet(node).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function beforeUpdate(fn) {
        get_current_component().$$.before_update.push(fn);
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }
    function setContext(key, context) {
        get_current_component().$$.context.set(key, context);
    }
    function getContext(key) {
        return get_current_component().$$.context.get(key);
    }
    function getAllContexts() {
        return get_current_component().$$.context;
    }
    function hasContext(key) {
        return get_current_component().$$.context.has(key);
    }
    // TODO figure out if we still want to support
    // shorthand events, or if we want to implement
    // a real bubbling mechanism
    function bubble(component, event) {
        const callbacks = component.$$.callbacks[event.type];
        if (callbacks) {
            // @ts-ignore
            callbacks.slice().forEach(fn => fn.call(this, event));
        }
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush$1);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    function add_flush_callback(fn) {
        flush_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush$1() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = (program.b - t);
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    function handle_promise(promise, info) {
        const token = info.token = {};
        function update(type, index, key, value) {
            if (info.token !== token)
                return;
            info.resolved = value;
            let child_ctx = info.ctx;
            if (key !== undefined) {
                child_ctx = child_ctx.slice();
                child_ctx[key] = value;
            }
            const block = type && (info.current = type)(child_ctx);
            let needs_flush = false;
            if (info.block) {
                if (info.blocks) {
                    info.blocks.forEach((block, i) => {
                        if (i !== index && block) {
                            group_outros();
                            transition_out(block, 1, 1, () => {
                                if (info.blocks[i] === block) {
                                    info.blocks[i] = null;
                                }
                            });
                            check_outros();
                        }
                    });
                }
                else {
                    info.block.d(1);
                }
                block.c();
                transition_in(block, 1);
                block.m(info.mount(), info.anchor);
                needs_flush = true;
            }
            info.block = block;
            if (info.blocks)
                info.blocks[index] = block;
            if (needs_flush) {
                flush$1();
            }
        }
        if (is_promise(promise)) {
            const current_component = get_current_component();
            promise.then(value => {
                set_current_component(current_component);
                update(info.then, 1, info.value, value);
                set_current_component(null);
            }, error => {
                set_current_component(current_component);
                update(info.catch, 2, info.error, error);
                set_current_component(null);
                if (!info.hasCatch) {
                    throw error;
                }
            });
            // if we previously had a then/catch block, destroy it
            if (info.current !== info.pending) {
                update(info.pending, 0);
                return true;
            }
        }
        else {
            if (info.current !== info.then) {
                update(info.then, 1, info.value, promise);
                return true;
            }
            info.resolved = promise;
        }
    }
    function update_await_block_branch(info, ctx, dirty) {
        const child_ctx = ctx.slice();
        const { resolved } = info;
        if (info.current === info.then) {
            child_ctx[info.value] = resolved;
        }
        if (info.current === info.catch) {
            child_ctx[info.error] = resolved;
        }
        info.block.p(child_ctx, dirty);
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);

    function bind$1(component, name, callback) {
        const index = component.$$.props[name];
        if (index !== undefined) {
            component.$$.bound[index] = callback;
            callback(component.$$.ctx[index]);
        }
    }
    function create_component(block) {
        block && block.c();
    }
    function claim_component(block, parent_nodes) {
        block && block.l(parent_nodes);
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init$1(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                start_hydrating();
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            end_hydrating();
            flush$1();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.44.1' }, detail), true));
    }
    function append_hydration_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append_hydration(target, node);
    }
    function insert_hydration_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert_hydration(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }
    /**
     * Base class to create strongly typed Svelte components.
     * This only exists for typing purposes and should be used in `.d.ts` files.
     *
     * ### Example:
     *
     * You have component library on npm called `component-library`, from which
     * you export a component called `MyComponent`. For Svelte+TypeScript users,
     * you want to provide typings. Therefore you create a `index.d.ts`:
     * ```ts
     * import { SvelteComponentTyped } from "svelte";
     * export class MyComponent extends SvelteComponentTyped<{foo: string}> {}
     * ```
     * Typing this makes it possible for IDEs like VS Code with the Svelte extension
     * to provide intellisense and to use the component like this in a Svelte file
     * with TypeScript:
     * ```svelte
     * <script lang="ts">
     * 	import { MyComponent } from "component-library";
     * </script>
     * <MyComponent foo={'bar'} />
     * ```
     *
     * #### Why not make this part of `SvelteComponent(Dev)`?
     * Because
     * ```ts
     * class ASubclassOfSvelteComponent extends SvelteComponent<{foo: string}> {}
     * const component: typeof SvelteComponent = ASubclassOfSvelteComponent;
     * ```
     * will throw a type error, so we need to separate the more strictly typed class.
     */
    class SvelteComponentTyped extends SvelteComponentDev {
        constructor(options) {
            super(options);
        }
    }

    /* node_modules\ashcomm-core-svelte\Input\Input.svelte generated by Svelte v3.44.1 */

    const file$l = "node_modules\\ashcomm-core-svelte\\Input\\Input.svelte";

    function create_fragment$m(ctx) {
    	let input;
    	let input_class_value;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			input = element("input");
    			this.h();
    		},
    		l: function claim(nodes) {
    			input = claim_element(nodes, "INPUT", {
    				class: true,
    				name: true,
    				type: true,
    				id: true,
    				style: true,
    				placeholder: true,
    				title: true,
    				maxlength: true,
    				minlength: true,
    				"aria-invalid": true,
    				autocomplete: true,
    				pattern: true,
    				"data-testid": true
    			});

    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(input, "class", input_class_value = "" + (null_to_empty(/*classes*/ ctx[14]) + " svelte-1io0gry"));
    			attr_dev(input, "name", /*name*/ ctx[2]);
    			attr_dev(input, "type", /*type*/ ctx[1]);
    			input.disabled = /*disabled*/ ctx[12];
    			attr_dev(input, "id", /*id*/ ctx[3]);
    			attr_dev(input, "style", /*style*/ ctx[4]);
    			input.value = /*value*/ ctx[0];
    			attr_dev(input, "placeholder", /*placeholder*/ ctx[6]);
    			attr_dev(input, "title", /*title*/ ctx[5]);
    			input.required = /*required*/ ctx[7];
    			attr_dev(input, "maxlength", /*maxlength*/ ctx[8]);
    			attr_dev(input, "minlength", /*minlength*/ ctx[9]);
    			attr_dev(input, "aria-invalid", /*ariaInvalid*/ ctx[13]);
    			attr_dev(input, "autocomplete", /*autocomplete*/ ctx[10]);
    			attr_dev(input, "pattern", /*pattern*/ ctx[11]);
    			attr_dev(input, "data-testid", "mainInput");
    			add_location(input, file$l, 35, 0, 950);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, input, anchor);

    			if (!mounted) {
    				dispose = [
    					listen_dev(input, "click", /*clearTest*/ ctx[15], false, false, false),
    					listen_dev(input, "blur", /*clearTest*/ ctx[15], false, false, false),
    					listen_dev(input, "input", /*handleInput*/ ctx[16], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*classes*/ 16384 && input_class_value !== (input_class_value = "" + (null_to_empty(/*classes*/ ctx[14]) + " svelte-1io0gry"))) {
    				attr_dev(input, "class", input_class_value);
    			}

    			if (dirty & /*name*/ 4) {
    				attr_dev(input, "name", /*name*/ ctx[2]);
    			}

    			if (dirty & /*type*/ 2) {
    				attr_dev(input, "type", /*type*/ ctx[1]);
    			}

    			if (dirty & /*disabled*/ 4096) {
    				prop_dev(input, "disabled", /*disabled*/ ctx[12]);
    			}

    			if (dirty & /*id*/ 8) {
    				attr_dev(input, "id", /*id*/ ctx[3]);
    			}

    			if (dirty & /*style*/ 16) {
    				attr_dev(input, "style", /*style*/ ctx[4]);
    			}

    			if (dirty & /*value*/ 1 && input.value !== /*value*/ ctx[0]) {
    				prop_dev(input, "value", /*value*/ ctx[0]);
    			}

    			if (dirty & /*placeholder*/ 64) {
    				attr_dev(input, "placeholder", /*placeholder*/ ctx[6]);
    			}

    			if (dirty & /*title*/ 32) {
    				attr_dev(input, "title", /*title*/ ctx[5]);
    			}

    			if (dirty & /*required*/ 128) {
    				prop_dev(input, "required", /*required*/ ctx[7]);
    			}

    			if (dirty & /*maxlength*/ 256) {
    				attr_dev(input, "maxlength", /*maxlength*/ ctx[8]);
    			}

    			if (dirty & /*minlength*/ 512) {
    				attr_dev(input, "minlength", /*minlength*/ ctx[9]);
    			}

    			if (dirty & /*ariaInvalid*/ 8192) {
    				attr_dev(input, "aria-invalid", /*ariaInvalid*/ ctx[13]);
    			}

    			if (dirty & /*autocomplete*/ 1024) {
    				attr_dev(input, "autocomplete", /*autocomplete*/ ctx[10]);
    			}

    			if (dirty & /*pattern*/ 2048) {
    				attr_dev(input, "pattern", /*pattern*/ ctx[11]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(input);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$m.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$m($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Input', slots, []);
    	let { type, name = undefined, value = "", id = undefined, style = undefined, title = undefined, placeholder = "", required = undefined, maxlength = undefined, minlength = undefined, autocomplete = undefined, pattern = undefined, disabled = undefined, ariaInvalid = undefined } = $$props;
    	let internalPlaceholder = placeholder;
    	let { class: classes = '' } = $$props;

    	function clearTest(e) {
    		if (e.target.className.indexOf('no-outline') != -1) {
    			if (!e.target.value && e.target.placeholder != "") {
    				e.target.placeholder = "";
    			} else if (!e.target.value) {
    				e.target.placeholder = internalPlaceholder;
    			}
    		}
    	}

    	function handleInput(e) {
    		$$invalidate(0, value = type.match(/^(number|range)$/)
    		? +e.target.value
    		: e.target.value);
    	}

    	const writable_props = [
    		'type',
    		'name',
    		'value',
    		'id',
    		'style',
    		'title',
    		'placeholder',
    		'required',
    		'maxlength',
    		'minlength',
    		'autocomplete',
    		'pattern',
    		'disabled',
    		'ariaInvalid',
    		'class'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Input> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    		if ('name' in $$props) $$invalidate(2, name = $$props.name);
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('id' in $$props) $$invalidate(3, id = $$props.id);
    		if ('style' in $$props) $$invalidate(4, style = $$props.style);
    		if ('title' in $$props) $$invalidate(5, title = $$props.title);
    		if ('placeholder' in $$props) $$invalidate(6, placeholder = $$props.placeholder);
    		if ('required' in $$props) $$invalidate(7, required = $$props.required);
    		if ('maxlength' in $$props) $$invalidate(8, maxlength = $$props.maxlength);
    		if ('minlength' in $$props) $$invalidate(9, minlength = $$props.minlength);
    		if ('autocomplete' in $$props) $$invalidate(10, autocomplete = $$props.autocomplete);
    		if ('pattern' in $$props) $$invalidate(11, pattern = $$props.pattern);
    		if ('disabled' in $$props) $$invalidate(12, disabled = $$props.disabled);
    		if ('ariaInvalid' in $$props) $$invalidate(13, ariaInvalid = $$props.ariaInvalid);
    		if ('class' in $$props) $$invalidate(14, classes = $$props.class);
    	};

    	$$self.$capture_state = () => ({
    		type,
    		name,
    		value,
    		id,
    		style,
    		title,
    		placeholder,
    		required,
    		maxlength,
    		minlength,
    		autocomplete,
    		pattern,
    		disabled,
    		ariaInvalid,
    		internalPlaceholder,
    		classes,
    		clearTest,
    		handleInput
    	});

    	$$self.$inject_state = $$props => {
    		if ('type' in $$props) $$invalidate(1, type = $$props.type);
    		if ('name' in $$props) $$invalidate(2, name = $$props.name);
    		if ('value' in $$props) $$invalidate(0, value = $$props.value);
    		if ('id' in $$props) $$invalidate(3, id = $$props.id);
    		if ('style' in $$props) $$invalidate(4, style = $$props.style);
    		if ('title' in $$props) $$invalidate(5, title = $$props.title);
    		if ('placeholder' in $$props) $$invalidate(6, placeholder = $$props.placeholder);
    		if ('required' in $$props) $$invalidate(7, required = $$props.required);
    		if ('maxlength' in $$props) $$invalidate(8, maxlength = $$props.maxlength);
    		if ('minlength' in $$props) $$invalidate(9, minlength = $$props.minlength);
    		if ('autocomplete' in $$props) $$invalidate(10, autocomplete = $$props.autocomplete);
    		if ('pattern' in $$props) $$invalidate(11, pattern = $$props.pattern);
    		if ('disabled' in $$props) $$invalidate(12, disabled = $$props.disabled);
    		if ('ariaInvalid' in $$props) $$invalidate(13, ariaInvalid = $$props.ariaInvalid);
    		if ('internalPlaceholder' in $$props) internalPlaceholder = $$props.internalPlaceholder;
    		if ('classes' in $$props) $$invalidate(14, classes = $$props.classes);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		value,
    		type,
    		name,
    		id,
    		style,
    		title,
    		placeholder,
    		required,
    		maxlength,
    		minlength,
    		autocomplete,
    		pattern,
    		disabled,
    		ariaInvalid,
    		classes,
    		clearTest,
    		handleInput
    	];
    }

    class Input extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$m, create_fragment$m, not_equal, {
    			type: 1,
    			name: 2,
    			value: 0,
    			id: 3,
    			style: 4,
    			title: 5,
    			placeholder: 6,
    			required: 7,
    			maxlength: 8,
    			minlength: 9,
    			autocomplete: 10,
    			pattern: 11,
    			disabled: 12,
    			ariaInvalid: 13,
    			class: 14
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Input",
    			options,
    			id: create_fragment$m.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*type*/ ctx[1] === undefined && !('type' in props)) {
    			console.warn("<Input> was created without expected prop 'type'");
    		}
    	}

    	get type() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get name() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get title() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set title(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get placeholder() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholder(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get required() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set required(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get maxlength() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set maxlength(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get minlength() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set minlength(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get autocomplete() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set autocomplete(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get pattern() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set pattern(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get ariaInvalid() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set ariaInvalid(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Input>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Input>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\Button\Button.svelte generated by Svelte v3.44.1 */

    const file$k = "node_modules\\ashcomm-core-svelte\\Button\\Button.svelte";

    function create_fragment$l(ctx) {
    	let button;
    	let t0;
    	let t1;
    	let button_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[9].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[8], null);

    	const block = {
    		c: function create() {
    			button = element("button");
    			t0 = text(/*label*/ ctx[6]);
    			t1 = space();
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", {
    				class: true,
    				name: true,
    				type: true,
    				id: true,
    				style: true,
    				"data-testid": true
    			});

    			var button_nodes = children(button);
    			t0 = claim_text(button_nodes, /*label*/ ctx[6]);
    			t1 = claim_space(button_nodes);
    			if (default_slot) default_slot.l(button_nodes);
    			button_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", button_class_value = "" + (null_to_empty(/*classes*/ ctx[7]) + " svelte-1lc9ua7"));
    			attr_dev(button, "name", /*name*/ ctx[0]);
    			attr_dev(button, "type", /*type*/ ctx[2]);
    			button.disabled = /*disabled*/ ctx[3];
    			button.value = /*value*/ ctx[1];
    			attr_dev(button, "id", /*id*/ ctx[4]);
    			attr_dev(button, "style", /*style*/ ctx[5]);
    			attr_dev(button, "data-testid", "button");
    			add_location(button, file$k, 13, 0, 217);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);
    			append_hydration_dev(button, t0);
    			append_hydration_dev(button, t1);

    			if (default_slot) {
    				default_slot.m(button, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[10], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*label*/ 64) set_data_dev(t0, /*label*/ ctx[6]);

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 256)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[8],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[8])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[8], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*classes*/ 128 && button_class_value !== (button_class_value = "" + (null_to_empty(/*classes*/ ctx[7]) + " svelte-1lc9ua7"))) {
    				attr_dev(button, "class", button_class_value);
    			}

    			if (!current || dirty & /*name*/ 1) {
    				attr_dev(button, "name", /*name*/ ctx[0]);
    			}

    			if (!current || dirty & /*type*/ 4) {
    				attr_dev(button, "type", /*type*/ ctx[2]);
    			}

    			if (!current || dirty & /*disabled*/ 8) {
    				prop_dev(button, "disabled", /*disabled*/ ctx[3]);
    			}

    			if (!current || dirty & /*value*/ 2) {
    				prop_dev(button, "value", /*value*/ ctx[1]);
    			}

    			if (!current || dirty & /*id*/ 16) {
    				attr_dev(button, "id", /*id*/ ctx[4]);
    			}

    			if (!current || dirty & /*style*/ 32) {
    				attr_dev(button, "style", /*style*/ ctx[5]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$l.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$l($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Button', slots, ['default']);
    	let { name = "", value = undefined, type = undefined, disabled = false, id = undefined, style = undefined, label = "" } = $$props;
    	let { class: classes = '' } = $$props;
    	const writable_props = ['name', 'value', 'type', 'disabled', 'id', 'style', 'label', 'class'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Button> was created with unknown prop '${key}'`);
    	});

    	function click_handler(event) {
    		bubble.call(this, $$self, event);
    	}

    	$$self.$$set = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('type' in $$props) $$invalidate(2, type = $$props.type);
    		if ('disabled' in $$props) $$invalidate(3, disabled = $$props.disabled);
    		if ('id' in $$props) $$invalidate(4, id = $$props.id);
    		if ('style' in $$props) $$invalidate(5, style = $$props.style);
    		if ('label' in $$props) $$invalidate(6, label = $$props.label);
    		if ('class' in $$props) $$invalidate(7, classes = $$props.class);
    		if ('$$scope' in $$props) $$invalidate(8, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		name,
    		value,
    		type,
    		disabled,
    		id,
    		style,
    		label,
    		classes
    	});

    	$$self.$inject_state = $$props => {
    		if ('name' in $$props) $$invalidate(0, name = $$props.name);
    		if ('value' in $$props) $$invalidate(1, value = $$props.value);
    		if ('type' in $$props) $$invalidate(2, type = $$props.type);
    		if ('disabled' in $$props) $$invalidate(3, disabled = $$props.disabled);
    		if ('id' in $$props) $$invalidate(4, id = $$props.id);
    		if ('style' in $$props) $$invalidate(5, style = $$props.style);
    		if ('label' in $$props) $$invalidate(6, label = $$props.label);
    		if ('classes' in $$props) $$invalidate(7, classes = $$props.classes);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		name,
    		value,
    		type,
    		disabled,
    		id,
    		style,
    		label,
    		classes,
    		$$scope,
    		slots,
    		click_handler
    	];
    }

    class Button extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$l, create_fragment$l, not_equal, {
    			name: 0,
    			value: 1,
    			type: 2,
    			disabled: 3,
    			id: 4,
    			style: 5,
    			label: 6,
    			class: 7
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Button",
    			options,
    			id: create_fragment$l.name
    		});
    	}

    	get name() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set name(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get value() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set value(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get type() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set type(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get disabled() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set disabled(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get id() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get label() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set label(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<Button>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<Button>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\arrow-carousel-left-icon.svelte generated by Svelte v3.44.1 */

    const file$j = "node_modules\\ashcomm-core-svelte\\SVG\\arrow-carousel-left-icon.svelte";

    function create_fragment$k(ctx) {
    	let svg;
    	let defs;
    	let style;
    	let t;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			style = svg_element("style");
    			t = text(".fd460280-1ac3-4805-96ff-eb4d661e5190{fill:#908f8f;}");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				id: true,
    				"data-name": true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			defs = claim_svg_element(svg_nodes, "defs", {});
    			var defs_nodes = children(defs);
    			style = claim_svg_element(defs_nodes, "style", {});
    			var style_nodes = children(style);
    			t = claim_text(style_nodes, ".fd460280-1ac3-4805-96ff-eb4d661e5190{fill:#908f8f;}");
    			style_nodes.forEach(detach_dev);
    			defs_nodes.forEach(detach_dev);
    			path = claim_svg_element(svg_nodes, "path", { class: true, d: true, transform: true });
    			children(path).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(style, file$j, 6, 161, 276);
    			add_location(defs, file$j, 6, 155, 270);
    			attr_dev(path, "class", "fd460280-1ac3-4805-96ff-eb4d661e5190");
    			attr_dev(path, "d", "M3.13,6a.14.14,0,0,0,0-.2h0L.36,3,3.15.26a.18.18,0,0,0,0-.22.16.16,0,0,0-.22,0L.05,2.89a.14.14,0,0,0,0,.21H0L2.92,6a.14.14,0,0,0,.2,0Z");
    			attr_dev(path, "transform", "translate(0 0)");
    			add_location(path, file$j, 6, 235, 350);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "id", "arrow-left-icon");
    			attr_dev(svg, "data-name", "Layer 1");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 3.19 6.08");
    			add_location(svg, file$j, 6, 0, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, defs);
    			append_hydration_dev(defs, style);
    			append_hydration_dev(style, t);
    			append_hydration_dev(svg, path);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*size, width*/ 5 && svg_width_value !== (svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0])) {
    				attr_dev(svg, "width", svg_width_value);
    			}

    			if (dirty & /*size, height*/ 6 && svg_height_value !== (svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1])) {
    				attr_dev(svg, "height", svg_height_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$k.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$k($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Arrow_carousel_left_icon', slots, []);
    	let { width = undefined, height = undefined, size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Arrow_carousel_left_icon> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	$$self.$capture_state = () => ({ width, height, size });

    	$$self.$inject_state = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width, height, size];
    }

    class Arrow_carousel_left_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$k, create_fragment$k, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Arrow_carousel_left_icon",
    			options,
    			id: create_fragment$k.name
    		});
    	}

    	get width() {
    		throw new Error("<Arrow_carousel_left_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Arrow_carousel_left_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Arrow_carousel_left_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Arrow_carousel_left_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Arrow_carousel_left_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Arrow_carousel_left_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\cart-quantity-shadow.svelte generated by Svelte v3.44.1 */

    const file$i = "node_modules\\ashcomm-core-svelte\\SVG\\cart-quantity-shadow.svelte";

    function create_fragment$j(ctx) {
    	let svg;
    	let defs;
    	let style;
    	let t;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			style = svg_element("style");
    			t = text(".e67a26b0-543f-44ae-ac48-d7133ee13953{fill:#e6e6e6;}");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				id: true,
    				"data-name": true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			defs = claim_svg_element(svg_nodes, "defs", {});
    			var defs_nodes = children(defs);
    			style = claim_svg_element(defs_nodes, "style", {});
    			var style_nodes = children(style);
    			t = claim_text(style_nodes, ".e67a26b0-543f-44ae-ac48-d7133ee13953{fill:#e6e6e6;}");
    			style_nodes.forEach(detach_dev);
    			defs_nodes.forEach(detach_dev);
    			path = claim_svg_element(svg_nodes, "path", { class: true, d: true });
    			children(path).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(style, file$i, 6, 168, 283);
    			add_location(defs, file$i, 6, 162, 277);
    			attr_dev(path, "class", "e67a26b0-543f-44ae-ac48-d7133ee13953");
    			attr_dev(path, "d", "M0,11.3,4,7.4V0H33.81V21.73H4V14.27Z");
    			add_location(path, file$i, 6, 242, 357);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "id", "cart-quantity-shadow");
    			attr_dev(svg, "data-name", "Layer 1");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 33.81 21.73");
    			add_location(svg, file$i, 6, 0, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, defs);
    			append_hydration_dev(defs, style);
    			append_hydration_dev(style, t);
    			append_hydration_dev(svg, path);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*size, width*/ 5 && svg_width_value !== (svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0])) {
    				attr_dev(svg, "width", svg_width_value);
    			}

    			if (dirty & /*size, height*/ 6 && svg_height_value !== (svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1])) {
    				attr_dev(svg, "height", svg_height_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$j.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$j($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Cart_quantity_shadow', slots, []);
    	let { width = undefined, height = undefined, size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Cart_quantity_shadow> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	$$self.$capture_state = () => ({ width, height, size });

    	$$self.$inject_state = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width, height, size];
    }

    class Cart_quantity_shadow extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$j, create_fragment$j, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Cart_quantity_shadow",
    			options,
    			id: create_fragment$j.name
    		});
    	}

    	get width() {
    		throw new Error("<Cart_quantity_shadow>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Cart_quantity_shadow>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Cart_quantity_shadow>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Cart_quantity_shadow>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Cart_quantity_shadow>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Cart_quantity_shadow>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\close-icon.svelte generated by Svelte v3.44.1 */

    const file$h = "node_modules\\ashcomm-core-svelte\\SVG\\close-icon.svelte";

    function create_fragment$i(ctx) {
    	let svg;
    	let defs;
    	let style;
    	let t;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			style = svg_element("style");
    			t = text(".e9d47093-e205-4882-bec5-586279928b1d{fill:#999;}");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				id: true,
    				"data-name": true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			defs = claim_svg_element(svg_nodes, "defs", {});
    			var defs_nodes = children(defs);
    			style = claim_svg_element(defs_nodes, "style", {});
    			var style_nodes = children(style);
    			t = claim_text(style_nodes, ".e9d47093-e205-4882-bec5-586279928b1d{fill:#999;}");
    			style_nodes.forEach(detach_dev);
    			defs_nodes.forEach(detach_dev);
    			path = claim_svg_element(svg_nodes, "path", { class: true, d: true });
    			children(path).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(style, file$h, 6, 179, 294);
    			add_location(defs, file$h, 6, 173, 288);
    			attr_dev(path, "class", "e9d47093-e205-4882-bec5-586279928b1d");
    			attr_dev(path, "d", "M7.3,10,4.7,6.2,2,10H0L3.7,4.9.2,0H2.3L4.7,3.6,7.2,0h2L5.8,4.9,9.4,10Z");
    			add_location(path, file$h, 6, 250, 365);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "id", "e44e7451-b2ac-41f8-a6d4-556b5a222912");
    			attr_dev(svg, "data-name", "Layer 1");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 9.4 10");
    			add_location(svg, file$h, 6, 0, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, defs);
    			append_hydration_dev(defs, style);
    			append_hydration_dev(style, t);
    			append_hydration_dev(svg, path);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*size, width*/ 5 && svg_width_value !== (svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0])) {
    				attr_dev(svg, "width", svg_width_value);
    			}

    			if (dirty & /*size, height*/ 6 && svg_height_value !== (svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1])) {
    				attr_dev(svg, "height", svg_height_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$i.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$i($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Close_icon', slots, []);
    	let { width = undefined, height = undefined, size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Close_icon> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	$$self.$capture_state = () => ({ width, height, size });

    	$$self.$inject_state = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width, height, size];
    }

    class Close_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$i, create_fragment$i, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Close_icon",
    			options,
    			id: create_fragment$i.name
    		});
    	}

    	get width() {
    		throw new Error("<Close_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Close_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Close_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Close_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Close_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Close_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\search-icon.svelte generated by Svelte v3.44.1 */

    const file$g = "node_modules\\ashcomm-core-svelte\\SVG\\search-icon.svelte";

    function create_fragment$h(ctx) {
    	let svg;
    	let defs;
    	let style;
    	let t;
    	let path0;
    	let path1;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			style = svg_element("style");
    			t = text(".accd67da-2a18-474a-a07d-3af17b1da775{fill:#3e3934;}");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				id: true,
    				"data-name": true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			defs = claim_svg_element(svg_nodes, "defs", {});
    			var defs_nodes = children(defs);
    			style = claim_svg_element(defs_nodes, "style", {});
    			var style_nodes = children(style);
    			t = claim_text(style_nodes, ".accd67da-2a18-474a-a07d-3af17b1da775{fill:#3e3934;}");
    			style_nodes.forEach(detach_dev);
    			defs_nodes.forEach(detach_dev);
    			path0 = claim_svg_element(svg_nodes, "path", { class: true, d: true, transform: true });
    			children(path0).forEach(detach_dev);
    			path1 = claim_svg_element(svg_nodes, "path", { class: true, d: true, transform: true });
    			children(path1).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(style, file$g, 6, 159, 274);
    			add_location(defs, file$g, 6, 153, 268);
    			attr_dev(path0, "class", "accd67da-2a18-474a-a07d-3af17b1da775");
    			attr_dev(path0, "d", "M7.05,14.11a7.06,7.06,0,0,1-7-7H0A7.05,7.05,0,0,1,7,0h.06a7.05,7.05,0,0,1,0,14.1Zm0-11.86a4.81,4.81,0,1,0,4.79,4.83v0A4.81,4.81,0,0,0,7.05,2.25Z");
    			attr_dev(path0, "transform", "translate(0 0)");
    			add_location(path0, file$g, 6, 233, 348);
    			attr_dev(path1, "class", "accd67da-2a18-474a-a07d-3af17b1da775");
    			attr_dev(path1, "d", "M16,16.83a1,1,0,0,1-.72-.29l-4.67-4.68a1,1,0,1,1,1.13-1.65,1.07,1.07,0,0,1,.26.26l4.68,4.68a1,1,0,0,1,0,1.39,1,1,0,0,1-.71.29Z");
    			attr_dev(path1, "transform", "translate(0 0)");
    			add_location(path1, file$g, 6, 461, 576);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "id", "search-icon");
    			attr_dev(svg, "data-name", "Layer 1");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 16.96 16.83");
    			add_location(svg, file$g, 6, 0, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, defs);
    			append_hydration_dev(defs, style);
    			append_hydration_dev(style, t);
    			append_hydration_dev(svg, path0);
    			append_hydration_dev(svg, path1);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*size, width*/ 5 && svg_width_value !== (svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0])) {
    				attr_dev(svg, "width", svg_width_value);
    			}

    			if (dirty & /*size, height*/ 6 && svg_height_value !== (svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1])) {
    				attr_dev(svg, "height", svg_height_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$h.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$h($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Search_icon', slots, []);
    	let { width = undefined, height = undefined, size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Search_icon> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	$$self.$capture_state = () => ({ width, height, size });

    	$$self.$inject_state = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width, height, size];
    }

    class Search_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$h, create_fragment$h, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search_icon",
    			options,
    			id: create_fragment$h.name
    		});
    	}

    	get width() {
    		throw new Error("<Search_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Search_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Search_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Search_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Search_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Search_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\shopping-cart-icon.svelte generated by Svelte v3.44.1 */

    const file$f = "node_modules\\ashcomm-core-svelte\\SVG\\shopping-cart-icon.svelte";

    function create_fragment$g(ctx) {
    	let svg;
    	let rect;
    	let g1;
    	let g0;
    	let circle0;
    	let circle1;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			rect = svg_element("rect");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			circle0 = svg_element("circle");
    			circle1 = svg_element("circle");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				version: true,
    				id: true,
    				xmlns: true,
    				"xmlns:xlink": true,
    				x: true,
    				y: true,
    				viewBox: true,
    				"enable-background": true,
    				"xml:space": true
    			});

    			var svg_nodes = children(svg);

    			rect = claim_svg_element(svg_nodes, "rect", {
    				x: true,
    				y: true,
    				fill: true,
    				width: true,
    				height: true
    			});

    			children(rect).forEach(detach_dev);
    			g1 = claim_svg_element(svg_nodes, "g", {});
    			var g1_nodes = children(g1);
    			g0 = claim_svg_element(g1_nodes, "g", {});
    			var g0_nodes = children(g0);
    			circle0 = claim_svg_element(g0_nodes, "circle", { cx: true, cy: true, r: true });
    			children(circle0).forEach(detach_dev);
    			circle1 = claim_svg_element(g0_nodes, "circle", { cx: true, cy: true, r: true });
    			children(circle1).forEach(detach_dev);
    			path = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path).forEach(detach_dev);
    			g0_nodes.forEach(detach_dev);
    			g1_nodes.forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(rect, "x", "-896.6");
    			attr_dev(rect, "y", "-897");
    			attr_dev(rect, "fill", "none");
    			attr_dev(rect, "width", "1800");
    			attr_dev(rect, "height", "1800");
    			add_location(rect, file$f, 8, 0, 380);
    			attr_dev(circle0, "cx", "5.363");
    			attr_dev(circle0, "cy", "5.57");
    			attr_dev(circle0, "r", "0.426");
    			add_location(circle0, file$f, 11, 2, 458);
    			attr_dev(circle1, "cx", "2.735");
    			attr_dev(circle1, "cy", "5.57");
    			attr_dev(circle1, "r", "0.426");
    			add_location(circle1, file$f, 12, 2, 501);
    			attr_dev(path, "d", "M6.818,0.94c-0.039-0.05-0.105-0.083-0.171-0.083H1.613L1.441,0.16C1.419,0.066,1.33,0,1.231,0H0.219\n\t\t\tC0.102,0,0.003,0.094,0.003,0.216c0,0.116,0.094,0.216,0.216,0.216H1.07l1.079,4.337c0.022,0.094,0.111,0.16,0.21,0.16h3.485\n\t\t\tc0.116,0,0.216-0.094,0.216-0.216c0-0.122-0.094-0.216-0.216-0.216H2.525l-0.16-0.642h3.64c0.1,0,0.183-0.066,0.21-0.16\n\t\t\tl0.642-2.572C6.873,1.057,6.856,0.99,6.818,0.94z M6.414,1.283L5.883,3.529L2.287,3.524l-0.564-2.24H6.414z");
    			add_location(path, file$f, 13, 2, 544);
    			add_location(g0, file$f, 10, 1, 452);
    			add_location(g1, file$f, 9, 0, 447);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "version", "1.1");
    			attr_dev(svg, "id", "shopping-cart-icon");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "xmlns:xlink", "http://www.w3.org/1999/xlink");
    			attr_dev(svg, "x", "0px");
    			attr_dev(svg, "y", "0px");
    			attr_dev(svg, "viewBox", "0 0 6.9 6");
    			attr_dev(svg, "enable-background", "new 0 0 6.9 6");
    			attr_dev(svg, "xml:space", "preserve");
    			add_location(svg, file$f, 6, 0, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, rect);
    			append_hydration_dev(svg, g1);
    			append_hydration_dev(g1, g0);
    			append_hydration_dev(g0, circle0);
    			append_hydration_dev(g0, circle1);
    			append_hydration_dev(g0, path);
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*size, width*/ 5 && svg_width_value !== (svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0])) {
    				attr_dev(svg, "width", svg_width_value);
    			}

    			if (dirty & /*size, height*/ 6 && svg_height_value !== (svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1])) {
    				attr_dev(svg, "height", svg_height_value);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(svg);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$g.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$g($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Shopping_cart_icon', slots, []);
    	let { width = undefined, height = undefined, size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Shopping_cart_icon> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	$$self.$capture_state = () => ({ width, height, size });

    	$$self.$inject_state = $$props => {
    		if ('width' in $$props) $$invalidate(0, width = $$props.width);
    		if ('height' in $$props) $$invalidate(1, height = $$props.height);
    		if ('size' in $$props) $$invalidate(2, size = $$props.size);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [width, height, size];
    }

    class Shopping_cart_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$g, create_fragment$g, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Shopping_cart_icon",
    			options,
    			id: create_fragment$g.name
    		});
    	}

    	get width() {
    		throw new Error("<Shopping_cart_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Shopping_cart_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Shopping_cart_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Shopping_cart_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Shopping_cart_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Shopping_cart_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    var svelte = /*#__PURE__*/Object.freeze({
        __proto__: null,
        SvelteComponent: SvelteComponentDev,
        SvelteComponentTyped: SvelteComponentTyped,
        afterUpdate: afterUpdate,
        beforeUpdate: beforeUpdate,
        createEventDispatcher: createEventDispatcher,
        getAllContexts: getAllContexts,
        getContext: getContext,
        hasContext: hasContext,
        onDestroy: onDestroy,
        onMount: onMount,
        setContext: setContext,
        tick: tick
    });

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }
    function quintOut(t) {
        return --t * t * t * t * t + 1;
    }

    function fade(node, { delay = 0, duration = 400, easing = identity } = {}) {
        const o = +getComputedStyle(node).opacity;
        return {
            delay,
            duration,
            easing,
            css: t => `opacity: ${t * o}`
        };
    }
    function slide(node, { delay = 0, duration = 400, easing = cubicOut } = {}) {
        const style = getComputedStyle(node);
        const opacity = +style.opacity;
        const height = parseFloat(style.height);
        const padding_top = parseFloat(style.paddingTop);
        const padding_bottom = parseFloat(style.paddingBottom);
        const margin_top = parseFloat(style.marginTop);
        const margin_bottom = parseFloat(style.marginBottom);
        const border_top_width = parseFloat(style.borderTopWidth);
        const border_bottom_width = parseFloat(style.borderBottomWidth);
        return {
            delay,
            duration,
            easing,
            css: t => 'overflow: hidden;' +
                `opacity: ${Math.min(t * 20, 1) * opacity};` +
                `height: ${t * height}px;` +
                `padding-top: ${t * padding_top}px;` +
                `padding-bottom: ${t * padding_bottom}px;` +
                `margin-top: ${t * margin_top}px;` +
                `margin-bottom: ${t * margin_bottom}px;` +
                `border-top-width: ${t * border_top_width}px;` +
                `border-bottom-width: ${t * border_bottom_width}px;`
        };
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    const defaultFormats = {
        number: {
            scientific: { notation: 'scientific' },
            engineering: { notation: 'engineering' },
            compactLong: { notation: 'compact', compactDisplay: 'long' },
            compactShort: { notation: 'compact', compactDisplay: 'short' },
        },
        date: {
            short: { month: 'numeric', day: 'numeric', year: '2-digit' },
            medium: { month: 'short', day: 'numeric', year: 'numeric' },
            long: { month: 'long', day: 'numeric', year: 'numeric' },
            full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' },
        },
        time: {
            short: { hour: 'numeric', minute: 'numeric' },
            medium: { hour: 'numeric', minute: 'numeric', second: 'numeric' },
            long: {
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                timeZoneName: 'short',
            },
            full: {
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                timeZoneName: 'short',
            },
        },
    };
    const defaultOptions = {
        fallbackLocale: '',
        initialLocale: '',
        loadingDelay: 200,
        formats: defaultFormats,
        warnOnMissingMessages: true,
    };
    const options = defaultOptions;
    let currentLocale;
    function getCurrentLocale() {
        return currentLocale;
    }
    function setCurrentLocale(val) {
        return currentLocale = val;
    }
    function getOptions() {
        return options;
    }
    function getSubLocales(refLocale) {
        return refLocale
            .split('-')
            .map((_, i, arr) => arr.slice(0, i + 1).join('-'))
            .reverse();
    }
    function getPossibleLocales(refLocale, fallbackLocale = getOptions().fallbackLocale) {
        const locales = getSubLocales(refLocale);
        if (fallbackLocale) {
            return [...new Set([...locales, ...getSubLocales(fallbackLocale)])];
        }
        return locales;
    }

    // @ts-ignore
    let dictionary;
    const $dictionary = writable({});
    function getLocaleDictionary(locale) {
        return dictionary[locale] || null;
    }
    function hasLocaleDictionary(locale) {
        return locale in dictionary;
    }
    function getMessageFromDictionary(locale, id) {
        if (hasLocaleDictionary(locale)) {
            const localeDictionary = getLocaleDictionary(locale);
            if (id in localeDictionary) {
                return localeDictionary[id];
            }
            const ids = id.split('.');
            let tmpDict = localeDictionary;
            for (let i = 0; i < ids.length; i++) {
                if (typeof tmpDict[ids[i]] !== 'object') {
                    return tmpDict[ids[i]] || null;
                }
                tmpDict = tmpDict[ids[i]];
            }
        }
        return null;
    }
    function getClosestAvailableLocale(refLocale) {
        if (refLocale == null)
            return null;
        const relatedLocales = getPossibleLocales(refLocale);
        for (let i = 0; i < relatedLocales.length; i++) {
            const locale = relatedLocales[i];
            if (hasLocaleDictionary(locale)) {
                return locale;
            }
        }
        return null;
    }
    function addMessages(locale, ...partials) {
        $dictionary.update(d => {
            d[locale] = Object.assign(d[locale] || {}, ...partials);
            return d;
        });
    }
    $dictionary.subscribe(newDictionary => (dictionary = newDictionary));

    // @ts-ignore
    const $isLoading = writable(false);

    const loaderQueue = {};
    function removeLocaleFromQueue(locale) {
        delete loaderQueue[locale];
    }
    function getLocaleQueue(locale) {
        return loaderQueue[locale];
    }
    function getLocalesQueues(locale) {
        return getPossibleLocales(locale)
            .reverse()
            .map(localeItem => {
            const queue = getLocaleQueue(localeItem);
            return [localeItem, queue ? [...queue] : []];
        })
            .filter(([, queue]) => queue.length > 0);
    }
    function hasLocaleQueue(locale) {
        return getPossibleLocales(locale)
            .reverse()
            .some(getLocaleQueue);
    }
    const activeLocaleFlushes = {};
    function flush(locale) {
        if (!hasLocaleQueue(locale))
            return Promise.resolve();
        if (locale in activeLocaleFlushes)
            return activeLocaleFlushes[locale];
        // get queue of XX-YY and XX locales
        const queues = getLocalesQueues(locale);
        // istanbul ignore if
        if (queues.length === 0)
            return Promise.resolve();
        const loadingDelay = setTimeout(() => $isLoading.set(true), getOptions().loadingDelay);
        // TODO what happens if some loader fails
        activeLocaleFlushes[locale] = Promise.all(queues.map(([locale, queue]) => {
            return Promise.all(queue.map(loader => loader())).then(partials => {
                removeLocaleFromQueue(locale);
                partials = partials.map(partial => partial.default || partial);
                addMessages(locale, ...partials);
            });
        })).then(() => {
            clearTimeout(loadingDelay);
            $isLoading.set(false);
            delete activeLocaleFlushes[locale];
        });
        return activeLocaleFlushes[locale];
    }

    const getLocaleFromNavigator = (ssrDefault) => {
        // istanbul ignore next
        if (typeof window === 'undefined') {
            return ssrDefault || null;
        }
        return window.navigator.language || window.navigator.languages[0];
    };

    const $locale = writable('');
    $locale.subscribe((newLocale) => {
        setCurrentLocale(newLocale);
        if (typeof window !== 'undefined') {
            document.documentElement.setAttribute('lang', newLocale);
        }
    });
    const localeSet = $locale.set;
    $locale.set = (newLocale) => {
        if (getClosestAvailableLocale(newLocale) && hasLocaleQueue(newLocale)) {
            return flush(newLocale).then(() => localeSet(newLocale));
        }
        return localeSet(newLocale);
    };
    // istanbul ignore next
    $locale.update = (fn) => {
        let currentLocale = getCurrentLocale();
        fn(currentLocale);
        localeSet(currentLocale);
    };

    function init(opts) {
        const { formats, ...rest } = opts;
        const initialLocale = opts.initialLocale || opts.fallbackLocale;
        const options = getOptions();
        Object.assign(options, rest, { initialLocale });
        if (formats) {
            if ('number' in formats) {
                Object.assign(options.formats.number, formats.number);
            }
            if ('date' in formats) {
                Object.assign(options.formats.date, formats.date);
            }
            if ('time' in formats) {
                Object.assign(options.formats.time, formats.time);
            }
        }
        return $locale.set(initialLocale);
    }

    const lookupCache = {};
    const addToCache = (path, locale, message) => {
        if (!message)
            return message;
        if (!(locale in lookupCache))
            lookupCache[locale] = {};
        if (!(path in lookupCache[locale]))
            lookupCache[locale][path] = message;
        return message;
    };
    const lookup = (path, refLocale) => {
        if (refLocale == null)
            return undefined;
        if (refLocale in lookupCache && path in lookupCache[refLocale]) {
            return lookupCache[refLocale][path];
        }
        const locales = getPossibleLocales(refLocale);
        for (let i = 0; i < locales.length; i++) {
            const locale = locales[i];
            const message = getMessageFromDictionary(locale, path);
            if (message) {
                // Used the requested locale as the cache key
                // Ex: { en: { title: "Title" }}
                // lookup('title', 'en-GB') should cache with 'en-GB' instead of 'en'
                return addToCache(path, refLocale, message);
            }
        }
        return undefined;
    };

    const formatMessage = (optionsOrId, maybeOptions = {}) => {
        const id = typeof optionsOrId === 'string' ? optionsOrId : optionsOrId.id;
        const options = typeof optionsOrId === 'string' ? maybeOptions : optionsOrId;
        const { values, locale = getCurrentLocale(), default: defaultValue, } = options;
        if (locale == null) {
            throw new Error('[svelte-i18n] Cannot format a message without first setting the initial locale.');
        }
        let message = lookup(id, locale);
        if (typeof message === 'string') {
            return message;
        }
        if (typeof message === 'function') {
            return message(...Object.keys(options.values || {}).sort().map(k => (options.values || {})[k]));
        }
        if (getOptions().warnOnMissingMessages) {
            // istanbul ignore next
            console.warn(`[svelte-i18n] The message "${id}" was not found in "${getPossibleLocales(locale).join('", "')}".${hasLocaleQueue(getCurrentLocale())
            ? `\n\nNote: there are at least one loader still registered to this locale that wasn't executed.`
            : ''}`);
        }
        return defaultValue || id;
    };
    const $format = /*@__PURE__*/ derived([$locale, $dictionary], () => formatMessage);

    var en = {
        "core.accordion.refine": "Refine by",
        "core.asset.no-content": "Page does not contain any content.",
        "core.field-error-message": "This field is required."
    };

    var es = {
        "core.accordion.refine": "Refine by SPANISH",
        "core.asset.no-content": "Page does not contain any content. SPANISH",
        "core.field-error-message": "This field is required. SPANISH"
    };

    function setupI18n() {
        
        addMessages("en", en);
        addMessages("es", es);

        init({
            fallbackLocale: 'en',
            initialLocale: getLocaleFromNavigator()
        });
    }

    /* node_modules\ashcomm-core-svelte\List\ListItem.svelte generated by Svelte v3.44.1 */

    const file$e = "node_modules\\ashcomm-core-svelte\\List\\ListItem.svelte";

    function create_fragment$f(ctx) {
    	let li;
    	let li_class_value;
    	let current;
    	const default_slot_template = /*#slots*/ ctx[5].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[4], null);

    	const block = {
    		c: function create() {
    			li = element("li");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			li = claim_element(nodes, "LI", {
    				class: true,
    				id: true,
    				style: true,
    				"data-testid": true
    			});

    			var li_nodes = children(li);
    			if (default_slot) default_slot.l(li_nodes);
    			li_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(li, "class", li_class_value = "" + (null_to_empty(/*classes*/ ctx[3]) + " svelte-ee5318"));
    			attr_dev(li, "id", /*id*/ ctx[0]);
    			attr_dev(li, "style", /*style*/ ctx[1]);
    			attr_dev(li, "data-testid", "mainListItem");
    			toggle_class(li, "horizontal", /*horizontal*/ ctx[2]);
    			add_location(li, file$e, 8, 0, 153);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, li, anchor);

    			if (default_slot) {
    				default_slot.m(li, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 16)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[4],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[4])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[4], dirty, null),
    						null
    					);
    				}
    			}

    			if (!current || dirty & /*classes*/ 8 && li_class_value !== (li_class_value = "" + (null_to_empty(/*classes*/ ctx[3]) + " svelte-ee5318"))) {
    				attr_dev(li, "class", li_class_value);
    			}

    			if (!current || dirty & /*id*/ 1) {
    				attr_dev(li, "id", /*id*/ ctx[0]);
    			}

    			if (!current || dirty & /*style*/ 2) {
    				attr_dev(li, "style", /*style*/ ctx[1]);
    			}

    			if (dirty & /*classes, horizontal*/ 12) {
    				toggle_class(li, "horizontal", /*horizontal*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$f.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$f($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ListItem', slots, ['default']);
    	let { id = undefined, style = undefined, horizontal = false } = $$props;
    	let { class: classes = '' } = $$props;
    	const writable_props = ['id', 'style', 'horizontal', 'class'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ListItem> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('horizontal' in $$props) $$invalidate(2, horizontal = $$props.horizontal);
    		if ('class' in $$props) $$invalidate(3, classes = $$props.class);
    		if ('$$scope' in $$props) $$invalidate(4, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ id, style, horizontal, classes });

    	$$self.$inject_state = $$props => {
    		if ('id' in $$props) $$invalidate(0, id = $$props.id);
    		if ('style' in $$props) $$invalidate(1, style = $$props.style);
    		if ('horizontal' in $$props) $$invalidate(2, horizontal = $$props.horizontal);
    		if ('classes' in $$props) $$invalidate(3, classes = $$props.classes);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [id, style, horizontal, classes, $$scope, slots];
    }

    class ListItem extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$f, create_fragment$f, not_equal, { id: 0, style: 1, horizontal: 2, class: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ListItem",
    			options,
    			id: create_fragment$f.name
    		});
    	}

    	get id() {
    		throw new Error("<ListItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set id(value) {
    		throw new Error("<ListItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<ListItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<ListItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get horizontal() {
    		throw new Error("<ListItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set horizontal(value) {
    		throw new Error("<ListItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get class() {
    		throw new Error("<ListItem>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set class(value) {
    		throw new Error("<ListItem>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\Modal\Modal.svelte generated by Svelte v3.44.1 */

    const { Object: Object_1 } = globals;
    const file$d = "node_modules\\ashcomm-core-svelte\\Modal\\Modal.svelte";

    // (152:0) {#if Component}
    function create_if_block$6(ctx) {
    	let div3;
    	let div2;
    	let div1;
    	let t;
    	let div0;
    	let switch_instance;
    	let div1_transition;
    	let div3_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*state*/ ctx[0].closeButton && create_if_block_1$4(ctx);
    	var switch_value = /*Component*/ ctx[1];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			div3 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			if (if_block) if_block.c();
    			t = space();
    			div0 = element("div");
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div3 = claim_element(nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true, style: true });
    			var div2_nodes = children(div2);

    			div1 = claim_element(div2_nodes, "DIV", {
    				class: true,
    				role: true,
    				"aria-modal": true,
    				style: true
    			});

    			var div1_nodes = children(div1);
    			if (if_block) if_block.l(div1_nodes);
    			t = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			if (switch_instance) claim_component(switch_instance.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "content svelte-o3tuy8");
    			attr_dev(div0, "style", /*cssContent*/ ctx[12]);
    			add_location(div0, file$d, 172, 16, 5545);
    			attr_dev(div1, "class", "window svelte-o3tuy8");
    			attr_dev(div1, "role", "dialog");
    			attr_dev(div1, "aria-modal", "true");
    			attr_dev(div1, "style", /*cssWindow*/ ctx[13]);
    			add_location(div1, file$d, 154, 12, 4769);
    			attr_dev(div2, "class", "window-wrap svelte-o3tuy8");
    			attr_dev(div2, "style", /*cssWindowWrap*/ ctx[14]);
    			add_location(div2, file$d, 153, 8, 4692);
    			attr_dev(div3, "class", "bg svelte-o3tuy8");
    			attr_dev(div3, "style", /*cssBg*/ ctx[15]);
    			add_location(div3, file$d, 152, 4, 4545);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div3, anchor);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, div1);
    			if (if_block) if_block.m(div1, null);
    			append_hydration_dev(div1, t);
    			append_hydration_dev(div1, div0);

    			if (switch_instance) {
    				mount_component(switch_instance, div0, null);
    			}

    			/*div1_binding*/ ctx[37](div1);
    			/*div2_binding*/ ctx[38](div2);
    			/*div3_binding*/ ctx[39](div3);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						div1,
    						"introstart",
    						function () {
    							if (is_function(/*onOpen*/ ctx[5])) /*onOpen*/ ctx[5].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"outrostart",
    						function () {
    							if (is_function(/*onClose*/ ctx[6])) /*onClose*/ ctx[6].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"introend",
    						function () {
    							if (is_function(/*onOpened*/ ctx[7])) /*onOpened*/ ctx[7].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(
    						div1,
    						"outroend",
    						function () {
    							if (is_function(/*onClosed*/ ctx[8])) /*onClosed*/ ctx[8].apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(div3, "click", /*handleOuterClick*/ ctx[19], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (/*state*/ ctx[0].closeButton) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*state*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_1$4(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (switch_value !== (switch_value = /*Component*/ ctx[1])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, div0, null);
    				} else {
    					switch_instance = null;
    				}
    			}

    			if (!current || dirty[0] & /*cssContent*/ 4096) {
    				attr_dev(div0, "style", /*cssContent*/ ctx[12]);
    			}

    			if (!current || dirty[0] & /*cssWindow*/ 8192) {
    				attr_dev(div1, "style", /*cssWindow*/ ctx[13]);
    			}

    			if (!current || dirty[0] & /*cssWindowWrap*/ 16384) {
    				attr_dev(div2, "style", /*cssWindowWrap*/ ctx[14]);
    			}

    			if (!current || dirty[0] & /*cssBg*/ 32768) {
    				attr_dev(div3, "style", /*cssBg*/ ctx[15]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[9], /*state*/ ctx[0].transitionWindowProps, true);
    				div1_transition.run(1);
    			});

    			add_render_callback(() => {
    				if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[10], /*state*/ ctx[0].transitionBgProps, true);
    				div3_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			if (!div1_transition) div1_transition = create_bidirectional_transition(div1, /*currentTransitionWindow*/ ctx[9], /*state*/ ctx[0].transitionWindowProps, false);
    			div1_transition.run(0);
    			if (!div3_transition) div3_transition = create_bidirectional_transition(div3, /*currentTransitionBg*/ ctx[10], /*state*/ ctx[0].transitionBgProps, false);
    			div3_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div3);
    			if (if_block) if_block.d();
    			if (switch_instance) destroy_component(switch_instance);
    			/*div1_binding*/ ctx[37](null);
    			if (detaching && div1_transition) div1_transition.end();
    			/*div2_binding*/ ctx[38](null);
    			/*div3_binding*/ ctx[39](null);
    			if (detaching && div3_transition) div3_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$6.name,
    		type: "if",
    		source: "(152:0) {#if Component}",
    		ctx
    	});

    	return block;
    }

    // (166:16) {#if state.closeButton}
    function create_if_block_1$4(ctx) {
    	let show_if;
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_2$2, create_else_block$3];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (show_if == null || dirty[0] & /*state*/ 1) show_if = !!/*isFunction*/ ctx[16](/*state*/ ctx[0].closeButton);
    		if (show_if) return 0;
    		return 1;
    	}

    	current_block_type_index = select_block_type(ctx, [-1, -1]);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx, dirty);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$4.name,
    		type: "if",
    		source: "(166:16) {#if state.closeButton}",
    		ctx
    	});

    	return block;
    }

    // (169:20) {:else}
    function create_else_block$3(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			this.h();
    		},
    		l: function claim(nodes) {
    			button = claim_element(nodes, "BUTTON", { class: true, style: true });
    			children(button).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(button, "class", "close svelte-o3tuy8");
    			attr_dev(button, "style", /*cssCloseButton*/ ctx[11]);
    			add_location(button, file$d, 169, 24, 5416);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*close*/ ctx[17], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (dirty[0] & /*cssCloseButton*/ 2048) {
    				attr_dev(button, "style", /*cssCloseButton*/ ctx[11]);
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$3.name,
    		type: "else",
    		source: "(169:20) {:else}",
    		ctx
    	});

    	return block;
    }

    // (167:20) {#if isFunction(state.closeButton)}
    function create_if_block_2$2(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*state*/ ctx[0].closeButton;

    	function switch_props(ctx) {
    		return {
    			props: { onClose: /*close*/ ctx[17] },
    			$$inline: true
    		};
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props(ctx));
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (switch_value !== (switch_value = /*state*/ ctx[0].closeButton)) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props(ctx));
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$2.name,
    		type: "if",
    		source: "(167:20) {#if isFunction(state.closeButton)}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$e(ctx) {
    	let t;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*Component*/ ctx[1] && create_if_block$6(ctx);
    	const default_slot_template = /*#slots*/ ctx[36].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[35], null);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			t = space();
    			if (default_slot) default_slot.c();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			t = claim_space(nodes);
    			if (default_slot) default_slot.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, t, anchor);

    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(window, "keydown", /*handleKeydown*/ ctx[18], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, dirty) {
    			if (/*Component*/ ctx[1]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty[0] & /*Component*/ 2) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$6(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t.parentNode, t);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty[1] & /*$$scope*/ 16)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[35],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[35])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[35], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$e.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function bind(Component, props = {}) {
    	return function ModalComponent(options) {
    		return new Component({
    				...options,
    				props: { ...props, ...options.props }
    			});
    	};
    }

    function instance$e($$self, $$props, $$invalidate) {
    	let cssBg;
    	let cssWindowWrap;
    	let cssWindow;
    	let cssContent;
    	let cssCloseButton;
    	let currentTransitionBg;
    	let currentTransitionWindow;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Modal', slots, ['default']);
    	const dispatch = createEventDispatcher();
    	const baseSetContext = setContext;
    	let { show = null } = $$props;
    	let { key = 'simple-modal' } = $$props;
    	let { closeButton = true } = $$props;
    	let { closeOnEsc = true } = $$props;
    	let { closeOnOuterClick = true } = $$props;
    	let { styleBg = { top: 0, left: 0 } } = $$props;
    	let { styleWindowWrap = {} } = $$props;
    	let { styleWindow = {} } = $$props;
    	let { styleContent = {} } = $$props;
    	let { styleCloseButton = {} } = $$props;
    	let { setContext: setContext$1 = baseSetContext } = $$props;
    	let { transitionBg = fade } = $$props;
    	let { transitionBgProps = { duration: 250 } } = $$props;
    	let { transitionWindow = transitionBg } = $$props;
    	let { transitionWindowProps = transitionBgProps } = $$props;

    	const defaultState = {
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps
    	};

    	let state = { ...defaultState };
    	let Component = null;
    	let background;
    	let wrap;
    	let modalWindow;
    	const camelCaseToDash = str => str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
    	const toCssString = props => Object.keys(props).reduce((str, key) => `${str}; ${camelCaseToDash(key)}: ${props[key]}`, '');
    	const isFunction = f => !!(f && f.constructor && f.call && f.apply);

    	const toVoid = () => {
    		
    	};

    	let onOpen = toVoid;
    	let onClose = toVoid;
    	let onOpened = toVoid;
    	let onClosed = toVoid;

    	const open = (NewComponent, newProps = {}, options = {}, callback = {}) => {
    		$$invalidate(1, Component = bind(NewComponent, newProps));
    		$$invalidate(0, state = { ...defaultState, ...options });

    		($$invalidate(5, onOpen = event => {
    			if (callback.onOpen) callback.onOpen(event);
    			dispatch('opening');
    		}), $$invalidate(6, onClose = event => {
    			if (callback.onClose) callback.onClose(event);
    			dispatch('closing');
    		}), $$invalidate(7, onOpened = event => {
    			if (callback.onOpened) callback.onOpened(event);
    			dispatch('opened');
    		}));

    		$$invalidate(8, onClosed = event => {
    			if (callback.onClosed) callback.onClosed(event);
    			dispatch('closed');
    		});
    	};

    	const close = (callback = {}) => {
    		$$invalidate(6, onClose = callback.onClose || onClose);
    		$$invalidate(8, onClosed = callback.onClosed || onClosed);
    		$$invalidate(1, Component = null);
    	};

    	const handleKeydown = event => {
    		if (state.closeOnEsc && Component && event.key === 'Escape') {
    			event.preventDefault();
    			close();
    		}

    		if (Component && event.key === 'Tab') {
    			// trap focus
    			const nodes = modalWindow.querySelectorAll('*');

    			const tabbable = Array.from(nodes).filter(node => node.tabIndex >= 0);
    			let index = tabbable.indexOf(document.activeElement);
    			if (index === -1 && event.shiftKey) index = 0;
    			index += tabbable.length + (event.shiftKey ? -1 : 1);
    			index %= tabbable.length;
    			tabbable[index].focus();
    			event.preventDefault();
    		}
    	};

    	const handleOuterClick = event => {
    		if (state.closeOnOuterClick && (event.target === background || event.target === wrap)) {
    			event.preventDefault();
    			close();
    		}
    	};

    	setContext$1(key, { open, close });

    	const writable_props = [
    		'show',
    		'key',
    		'closeButton',
    		'closeOnEsc',
    		'closeOnOuterClick',
    		'styleBg',
    		'styleWindowWrap',
    		'styleWindow',
    		'styleContent',
    		'styleCloseButton',
    		'setContext',
    		'transitionBg',
    		'transitionBgProps',
    		'transitionWindow',
    		'transitionWindowProps'
    	];

    	Object_1.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Modal> was created with unknown prop '${key}'`);
    	});

    	function div1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			modalWindow = $$value;
    			$$invalidate(4, modalWindow);
    		});
    	}

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			wrap = $$value;
    			$$invalidate(3, wrap);
    		});
    	}

    	function div3_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			background = $$value;
    			$$invalidate(2, background);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('show' in $$props) $$invalidate(20, show = $$props.show);
    		if ('key' in $$props) $$invalidate(21, key = $$props.key);
    		if ('closeButton' in $$props) $$invalidate(22, closeButton = $$props.closeButton);
    		if ('closeOnEsc' in $$props) $$invalidate(23, closeOnEsc = $$props.closeOnEsc);
    		if ('closeOnOuterClick' in $$props) $$invalidate(24, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ('styleBg' in $$props) $$invalidate(25, styleBg = $$props.styleBg);
    		if ('styleWindowWrap' in $$props) $$invalidate(26, styleWindowWrap = $$props.styleWindowWrap);
    		if ('styleWindow' in $$props) $$invalidate(27, styleWindow = $$props.styleWindow);
    		if ('styleContent' in $$props) $$invalidate(28, styleContent = $$props.styleContent);
    		if ('styleCloseButton' in $$props) $$invalidate(29, styleCloseButton = $$props.styleCloseButton);
    		if ('setContext' in $$props) $$invalidate(30, setContext$1 = $$props.setContext);
    		if ('transitionBg' in $$props) $$invalidate(31, transitionBg = $$props.transitionBg);
    		if ('transitionBgProps' in $$props) $$invalidate(32, transitionBgProps = $$props.transitionBgProps);
    		if ('transitionWindow' in $$props) $$invalidate(33, transitionWindow = $$props.transitionWindow);
    		if ('transitionWindowProps' in $$props) $$invalidate(34, transitionWindowProps = $$props.transitionWindowProps);
    		if ('$$scope' in $$props) $$invalidate(35, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		bind,
    		svelte,
    		fade,
    		createEventDispatcher,
    		dispatch,
    		baseSetContext,
    		show,
    		key,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		setContext: setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		defaultState,
    		state,
    		Component,
    		background,
    		wrap,
    		modalWindow,
    		camelCaseToDash,
    		toCssString,
    		isFunction,
    		toVoid,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		open,
    		close,
    		handleKeydown,
    		handleOuterClick,
    		currentTransitionWindow,
    		currentTransitionBg,
    		cssCloseButton,
    		cssContent,
    		cssWindow,
    		cssWindowWrap,
    		cssBg
    	});

    	$$self.$inject_state = $$props => {
    		if ('show' in $$props) $$invalidate(20, show = $$props.show);
    		if ('key' in $$props) $$invalidate(21, key = $$props.key);
    		if ('closeButton' in $$props) $$invalidate(22, closeButton = $$props.closeButton);
    		if ('closeOnEsc' in $$props) $$invalidate(23, closeOnEsc = $$props.closeOnEsc);
    		if ('closeOnOuterClick' in $$props) $$invalidate(24, closeOnOuterClick = $$props.closeOnOuterClick);
    		if ('styleBg' in $$props) $$invalidate(25, styleBg = $$props.styleBg);
    		if ('styleWindowWrap' in $$props) $$invalidate(26, styleWindowWrap = $$props.styleWindowWrap);
    		if ('styleWindow' in $$props) $$invalidate(27, styleWindow = $$props.styleWindow);
    		if ('styleContent' in $$props) $$invalidate(28, styleContent = $$props.styleContent);
    		if ('styleCloseButton' in $$props) $$invalidate(29, styleCloseButton = $$props.styleCloseButton);
    		if ('setContext' in $$props) $$invalidate(30, setContext$1 = $$props.setContext);
    		if ('transitionBg' in $$props) $$invalidate(31, transitionBg = $$props.transitionBg);
    		if ('transitionBgProps' in $$props) $$invalidate(32, transitionBgProps = $$props.transitionBgProps);
    		if ('transitionWindow' in $$props) $$invalidate(33, transitionWindow = $$props.transitionWindow);
    		if ('transitionWindowProps' in $$props) $$invalidate(34, transitionWindowProps = $$props.transitionWindowProps);
    		if ('state' in $$props) $$invalidate(0, state = $$props.state);
    		if ('Component' in $$props) $$invalidate(1, Component = $$props.Component);
    		if ('background' in $$props) $$invalidate(2, background = $$props.background);
    		if ('wrap' in $$props) $$invalidate(3, wrap = $$props.wrap);
    		if ('modalWindow' in $$props) $$invalidate(4, modalWindow = $$props.modalWindow);
    		if ('onOpen' in $$props) $$invalidate(5, onOpen = $$props.onOpen);
    		if ('onClose' in $$props) $$invalidate(6, onClose = $$props.onClose);
    		if ('onOpened' in $$props) $$invalidate(7, onOpened = $$props.onOpened);
    		if ('onClosed' in $$props) $$invalidate(8, onClosed = $$props.onClosed);
    		if ('currentTransitionWindow' in $$props) $$invalidate(9, currentTransitionWindow = $$props.currentTransitionWindow);
    		if ('currentTransitionBg' in $$props) $$invalidate(10, currentTransitionBg = $$props.currentTransitionBg);
    		if ('cssCloseButton' in $$props) $$invalidate(11, cssCloseButton = $$props.cssCloseButton);
    		if ('cssContent' in $$props) $$invalidate(12, cssContent = $$props.cssContent);
    		if ('cssWindow' in $$props) $$invalidate(13, cssWindow = $$props.cssWindow);
    		if ('cssWindowWrap' in $$props) $$invalidate(14, cssWindowWrap = $$props.cssWindowWrap);
    		if ('cssBg' in $$props) $$invalidate(15, cssBg = $$props.cssBg);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			$$invalidate(15, cssBg = toCssString(state.styleBg));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			$$invalidate(14, cssWindowWrap = toCssString(state.styleWindowWrap));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			$$invalidate(13, cssWindow = toCssString(state.styleWindow));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			$$invalidate(12, cssContent = toCssString(state.styleContent));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			$$invalidate(11, cssCloseButton = toCssString(state.styleCloseButton));
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			$$invalidate(10, currentTransitionBg = state.transitionBg);
    		}

    		if ($$self.$$.dirty[0] & /*state*/ 1) {
    			$$invalidate(9, currentTransitionWindow = state.transitionWindow);
    		}

    		if ($$self.$$.dirty[0] & /*show*/ 1048576) {
    			{
    				if (isFunction(show)) {
    					open(show);
    				} else {
    					close();
    				}
    			}
    		}
    	};

    	return [
    		state,
    		Component,
    		background,
    		wrap,
    		modalWindow,
    		onOpen,
    		onClose,
    		onOpened,
    		onClosed,
    		currentTransitionWindow,
    		currentTransitionBg,
    		cssCloseButton,
    		cssContent,
    		cssWindow,
    		cssWindowWrap,
    		cssBg,
    		isFunction,
    		close,
    		handleKeydown,
    		handleOuterClick,
    		show,
    		key,
    		closeButton,
    		closeOnEsc,
    		closeOnOuterClick,
    		styleBg,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		setContext$1,
    		transitionBg,
    		transitionBgProps,
    		transitionWindow,
    		transitionWindowProps,
    		$$scope,
    		slots,
    		div1_binding,
    		div2_binding,
    		div3_binding
    	];
    }

    class Modal extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(
    			this,
    			options,
    			instance$e,
    			create_fragment$e,
    			not_equal,
    			{
    				show: 20,
    				key: 21,
    				closeButton: 22,
    				closeOnEsc: 23,
    				closeOnOuterClick: 24,
    				styleBg: 25,
    				styleWindowWrap: 26,
    				styleWindow: 27,
    				styleContent: 28,
    				styleCloseButton: 29,
    				setContext: 30,
    				transitionBg: 31,
    				transitionBgProps: 32,
    				transitionWindow: 33,
    				transitionWindowProps: 34
    			},
    			null,
    			[-1, -1]
    		);

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Modal",
    			options,
    			id: create_fragment$e.name
    		});
    	}

    	get show() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set show(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get key() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set key(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeButton() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeButton(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnEsc() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnEsc(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get closeOnOuterClick() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set closeOnOuterClick(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleBg() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleBg(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleWindowWrap() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleWindowWrap(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleWindow() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleWindow(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleContent() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleContent(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get styleCloseButton() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set styleCloseButton(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get setContext() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set setContext(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionBg() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionBg(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionBgProps() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionBgProps(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionWindow() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionWindow(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionWindowProps() {
    		throw new Error("<Modal>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionWindowProps(value) {
    		throw new Error("<Modal>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\ContentAsset\ContentAsset.svelte generated by Svelte v3.44.1 */
    const file$c = "node_modules\\ashcomm-core-svelte\\ContentAsset\\ContentAsset.svelte";

    // (15:4) {:else}
    function create_else_block$2(ctx) {
    	let p;
    	let t_1_value = /*$t*/ ctx[3]("core.asset.no-content") + "";
    	let t_1;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t_1 = text(t_1_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			p = claim_element(nodes, "P", {});
    			var p_nodes = children(p);
    			t_1 = claim_text(p_nodes, t_1_value);
    			p_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(p, file$c, 15, 8, 429);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, p, anchor);
    			append_hydration_dev(p, t_1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$t*/ 8 && t_1_value !== (t_1_value = /*$t*/ ctx[3]("core.asset.no-content") + "")) set_data_dev(t_1, t_1_value);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$2.name,
    		type: "else",
    		source: "(15:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (13:34) 
    function create_if_block_1$3(ctx) {
    	let html_tag;
    	let html_anchor;

    	const block = {
    		c: function create() {
    			html_tag = new HtmlTagHydration();
    			html_anchor = empty();
    			this.h();
    		},
    		l: function claim(nodes) {
    			html_tag = claim_html_tag(nodes);
    			html_anchor = empty();
    			this.h();
    		},
    		h: function hydrate() {
    			html_tag.a = html_anchor;
    		},
    		m: function mount(target, anchor) {
    			html_tag.m(/*contentHTML*/ ctx[1], target, anchor);
    			insert_hydration_dev(target, html_anchor, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*contentHTML*/ 2) html_tag.p(/*contentHTML*/ ctx[1]);
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(html_anchor);
    			if (detaching) html_tag.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$3.name,
    		type: "if",
    		source: "(13:34) ",
    		ctx
    	});

    	return block;
    }

    // (11:4) {#if contentComponent != null}
    function create_if_block$5(ctx) {
    	let switch_instance;
    	let switch_instance_anchor;
    	let current;
    	var switch_value = /*contentComponent*/ ctx[0];

    	function switch_props(ctx) {
    		return { $$inline: true };
    	}

    	if (switch_value) {
    		switch_instance = new switch_value(switch_props());
    	}

    	const block = {
    		c: function create() {
    			if (switch_instance) create_component(switch_instance.$$.fragment);
    			switch_instance_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (switch_instance) claim_component(switch_instance.$$.fragment, nodes);
    			switch_instance_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (switch_instance) {
    				mount_component(switch_instance, target, anchor);
    			}

    			insert_hydration_dev(target, switch_instance_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (switch_value !== (switch_value = /*contentComponent*/ ctx[0])) {
    				if (switch_instance) {
    					group_outros();
    					const old_component = switch_instance;

    					transition_out(old_component.$$.fragment, 1, 0, () => {
    						destroy_component(old_component, 1);
    					});

    					check_outros();
    				}

    				if (switch_value) {
    					switch_instance = new switch_value(switch_props());
    					create_component(switch_instance.$$.fragment);
    					transition_in(switch_instance.$$.fragment, 1);
    					mount_component(switch_instance, switch_instance_anchor.parentNode, switch_instance_anchor);
    				} else {
    					switch_instance = null;
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			if (switch_instance) transition_in(switch_instance.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			if (switch_instance) transition_out(switch_instance.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(switch_instance_anchor);
    			if (switch_instance) destroy_component(switch_instance, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$5.name,
    		type: "if",
    		source: "(11:4) {#if contentComponent != null}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$d(ctx) {
    	let div;
    	let current_block_type_index;
    	let if_block;
    	let current;
    	const if_block_creators = [create_if_block$5, create_if_block_1$3, create_else_block$2];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*contentComponent*/ ctx[0] != null) return 0;
    		if (/*contentHTML*/ ctx[1] != null) return 1;
    		return 2;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", {
    				class: true,
    				style: true,
    				"data-testid": true
    			});

    			var div_nodes = children(div);
    			if_block.l(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "ContentAsset svelte-1v92ok3");
    			attr_dev(div, "style", /*style*/ ctx[2]);
    			attr_dev(div, "data-testid", "mainContentAsset");
    			add_location(div, file$c, 9, 0, 192);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			if_blocks[current_block_type_index].m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(div, null);
    			}

    			if (!current || dirty & /*style*/ 4) {
    				attr_dev(div, "style", /*style*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if_blocks[current_block_type_index].d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$d.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$d($$self, $$props, $$invalidate) {
    	let $t;
    	validate_store($format, 't');
    	component_subscribe($$self, $format, $$value => $$invalidate(3, $t = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ContentAsset', slots, []);
    	let { contentComponent = undefined, contentHTML = undefined, style = "" } = $$props;
    	setupI18n();
    	const writable_props = ['contentComponent', 'contentHTML', 'style'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ContentAsset> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('contentComponent' in $$props) $$invalidate(0, contentComponent = $$props.contentComponent);
    		if ('contentHTML' in $$props) $$invalidate(1, contentHTML = $$props.contentHTML);
    		if ('style' in $$props) $$invalidate(2, style = $$props.style);
    	};

    	$$self.$capture_state = () => ({
    		setupI18n,
    		t: $format,
    		contentComponent,
    		contentHTML,
    		style,
    		$t
    	});

    	$$self.$inject_state = $$props => {
    		if ('contentComponent' in $$props) $$invalidate(0, contentComponent = $$props.contentComponent);
    		if ('contentHTML' in $$props) $$invalidate(1, contentHTML = $$props.contentHTML);
    		if ('style' in $$props) $$invalidate(2, style = $$props.style);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [contentComponent, contentHTML, style, $t];
    }

    class ContentAsset extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$d, create_fragment$d, not_equal, {
    			contentComponent: 0,
    			contentHTML: 1,
    			style: 2
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ContentAsset",
    			options,
    			id: create_fragment$d.name
    		});
    	}

    	get contentComponent() {
    		throw new Error("<ContentAsset>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contentComponent(value) {
    		throw new Error("<ContentAsset>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get contentHTML() {
    		throw new Error("<ContentAsset>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contentHTML(value) {
    		throw new Error("<ContentAsset>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get style() {
    		throw new Error("<ContentAsset>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set style(value) {
    		throw new Error("<ContentAsset>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\Modal\Content.svelte generated by Svelte v3.44.1 */
    const file$b = "node_modules\\ashcomm-core-svelte\\Modal\\Content.svelte";

    function create_fragment$c(ctx) {
    	let div;
    	let current;
    	let mounted;
    	let dispose;
    	const default_slot_template = /*#slots*/ ctx[4].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[3], null);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (default_slot) default_slot.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", {});
    			var div_nodes = children(div);
    			if (default_slot) default_slot.l(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(div, file$b, 25, 0, 860);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			if (default_slot) {
    				default_slot.m(div, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(
    					div,
    					"click",
    					function () {
    						if (is_function(/*showPopup*/ ctx[0])) /*showPopup*/ ctx[0].apply(this, arguments);
    					},
    					false,
    					false,
    					false
    				);

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, [dirty]) {
    			ctx = new_ctx;

    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 8)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[3],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[3])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[3], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (default_slot) default_slot.d(detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$c.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$c($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Content', slots, ['default']);

    	const { open } = getContext('simple-modal')
    	? getContext('simple-modal')
    	: { open: undefined };

    	let { popupContent = '', popupContentHTML = '', showPopup } = $$props;

    	if (popupContentHTML) {
    		const contentComponent = function () {
    			//Create a Fragment node to avoid duplicate content in DOM
    			const fragmentedNode = document.createDocumentFragment();

    			return new ContentAsset({
    					target: fragmentedNode,
    					props: { contentHTML: popupContentHTML }
    				});
    		};

    		showPopup = () => open(contentComponent);
    	} else {
    		showPopup = () => open(popupContent);
    	}

    	const writable_props = ['popupContent', 'popupContentHTML', 'showPopup'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Content> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('popupContent' in $$props) $$invalidate(1, popupContent = $$props.popupContent);
    		if ('popupContentHTML' in $$props) $$invalidate(2, popupContentHTML = $$props.popupContentHTML);
    		if ('showPopup' in $$props) $$invalidate(0, showPopup = $$props.showPopup);
    		if ('$$scope' in $$props) $$invalidate(3, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({
    		getContext,
    		ContentAsset,
    		open,
    		popupContent,
    		popupContentHTML,
    		showPopup
    	});

    	$$self.$inject_state = $$props => {
    		if ('popupContent' in $$props) $$invalidate(1, popupContent = $$props.popupContent);
    		if ('popupContentHTML' in $$props) $$invalidate(2, popupContentHTML = $$props.popupContentHTML);
    		if ('showPopup' in $$props) $$invalidate(0, showPopup = $$props.showPopup);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [showPopup, popupContent, popupContentHTML, $$scope, slots];
    }

    class Content extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$c, create_fragment$c, not_equal, {
    			popupContent: 1,
    			popupContentHTML: 2,
    			showPopup: 0
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Content",
    			options,
    			id: create_fragment$c.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*showPopup*/ ctx[0] === undefined && !('showPopup' in props)) {
    			console.warn("<Content> was created without expected prop 'showPopup'");
    		}
    	}

    	get popupContent() {
    		throw new Error("<Content>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set popupContent(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get popupContentHTML() {
    		throw new Error("<Content>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set popupContentHTML(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get showPopup() {
    		throw new Error("<Content>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set showPopup(value) {
    		throw new Error("<Content>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Search\Search.svelte generated by Svelte v3.44.1 */
    const file$a = "src\\Search\\Search.svelte";

    // (33:8) <Button class="unset" style="margin-top:10px" name="search" type="submit" value="Submit" on:click={doSearch}              >
    function create_default_slot$5(ctx) {
    	let span;
    	let t;
    	let searchicon;
    	let current;
    	searchicon = new Search_icon({ $$inline: true });

    	const block = {
    		c: function create() {
    			span = element("span");
    			t = text("Search");
    			create_component(searchicon.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			span = claim_element(nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "Search");
    			span_nodes.forEach(detach_dev);
    			claim_component(searchicon.$$.fragment, nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "visually-hidden svelte-qm85qn");
    			add_location(span, file$a, 33, 13, 1223);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, span, anchor);
    			append_hydration_dev(span, t);
    			mount_component(searchicon, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(searchicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(searchicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    			destroy_component(searchicon, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$5.name,
    		type: "slot",
    		source: "(33:8) <Button class=\\\"unset\\\" style=\\\"margin-top:10px\\\" name=\\\"search\\\" type=\\\"submit\\\" value=\\\"Submit\\\" on:click={doSearch}              >",
    		ctx
    	});

    	return block;
    }

    function create_fragment$b(ctx) {
    	let div;
    	let form;
    	let label;
    	let t0;
    	let t1;
    	let span;
    	let t2;
    	let t3;
    	let input0;
    	let updating_value;
    	let t4;
    	let input1;
    	let t5;
    	let button;
    	let current;

    	function input0_value_binding(value) {
    		/*input0_value_binding*/ ctx[6](value);
    	}

    	let input0_props = {
    		type: "text",
    		id: /*q*/ ctx[0],
    		name: /*q*/ ctx[0],
    		placeholder: /*placeholder*/ ctx[1],
    		maxlength: "500",
    		class: "valid no-outline",
    		ariaInvalid: "false",
    		autocomplete: "off"
    	};

    	if (/*searchInputValue*/ ctx[4] !== void 0) {
    		input0_props.value = /*searchInputValue*/ ctx[4];
    	}

    	input0 = new Input({ props: input0_props, $$inline: true });
    	binding_callbacks.push(() => bind$1(input0, 'value', input0_value_binding));

    	input1 = new Input({
    			props: {
    				type: "hidden",
    				id: "lang",
    				name: "lang",
    				value: "default",
    				placeholder: "",
    				maxlength: "",
    				autocomplete: "off"
    			},
    			$$inline: true
    		});

    	button = new Button({
    			props: {
    				class: "unset",
    				style: "margin-top:10px",
    				name: "search",
    				type: "submit",
    				value: "Submit",
    				$$slots: { default: [create_default_slot$5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", /*doSearch*/ ctx[5]);

    	const block = {
    		c: function create() {
    			div = element("div");
    			form = element("form");
    			label = element("label");
    			t0 = text("Search Catalog");
    			t1 = space();
    			span = element("span");
    			t2 = text(/*accessibility*/ ctx[2]);
    			t3 = space();
    			create_component(input0.$$.fragment);
    			t4 = space();
    			create_component(input1.$$.fragment);
    			t5 = space();
    			create_component(button.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);

    			form = claim_element(div_nodes, "FORM", {
    				role: true,
    				action: true,
    				method: true,
    				name: true,
    				class: true
    			});

    			var form_nodes = children(form);
    			label = claim_element(form_nodes, "LABEL", { class: true, for: true });
    			var label_nodes = children(label);
    			t0 = claim_text(label_nodes, "Search Catalog");
    			label_nodes.forEach(detach_dev);
    			t1 = claim_space(form_nodes);
    			span = claim_element(form_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t2 = claim_text(span_nodes, /*accessibility*/ ctx[2]);
    			span_nodes.forEach(detach_dev);
    			t3 = claim_space(form_nodes);
    			claim_component(input0.$$.fragment, form_nodes);
    			t4 = claim_space(form_nodes);
    			claim_component(input1.$$.fragment, form_nodes);
    			t5 = claim_space(form_nodes);
    			claim_component(button.$$.fragment, form_nodes);
    			form_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(label, "class", "visually-hidden svelte-qm85qn");
    			attr_dev(label, "for", "q");
    			add_location(label, file$a, 18, 8, 531);
    			attr_dev(span, "class", "visually-hidden search-accessibility svelte-qm85qn");
    			add_location(span, file$a, 19, 8, 602);
    			attr_dev(form, "role", "search");
    			attr_dev(form, "action", /*formAction*/ ctx[3]);
    			attr_dev(form, "method", "get");
    			attr_dev(form, "name", "simpleSearch");
    			attr_dev(form, "class", "svelte-qm85qn");
    			add_location(form, file$a, 17, 4, 448);
    			attr_dev(div, "class", "header-search svelte-qm85qn");
    			add_location(div, file$a, 16, 0, 415);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, form);
    			append_hydration_dev(form, label);
    			append_hydration_dev(label, t0);
    			append_hydration_dev(form, t1);
    			append_hydration_dev(form, span);
    			append_hydration_dev(span, t2);
    			append_hydration_dev(form, t3);
    			mount_component(input0, form, null);
    			append_hydration_dev(form, t4);
    			mount_component(input1, form, null);
    			append_hydration_dev(form, t5);
    			mount_component(button, form, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*accessibility*/ 4) set_data_dev(t2, /*accessibility*/ ctx[2]);
    			const input0_changes = {};
    			if (dirty & /*q*/ 1) input0_changes.id = /*q*/ ctx[0];
    			if (dirty & /*q*/ 1) input0_changes.name = /*q*/ ctx[0];
    			if (dirty & /*placeholder*/ 2) input0_changes.placeholder = /*placeholder*/ ctx[1];

    			if (!updating_value && dirty & /*searchInputValue*/ 16) {
    				updating_value = true;
    				input0_changes.value = /*searchInputValue*/ ctx[4];
    				add_flush_callback(() => updating_value = false);
    			}

    			input0.$set(input0_changes);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 128) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);

    			if (!current || dirty & /*formAction*/ 8) {
    				attr_dev(form, "action", /*formAction*/ ctx[3]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(input0.$$.fragment, local);
    			transition_in(input1.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(input0.$$.fragment, local);
    			transition_out(input1.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(input0);
    			destroy_component(input1);
    			destroy_component(button);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Search', slots, []);
    	let { q, placeholder, accessibility, formAction } = $$props;
    	let searchInputValue = '';

    	function doSearch(e) {
    		e.stopPropagation();
    		e.preventDefault();
    		const href = '/search/' + searchInputValue;
    		location.href = href;
    	}

    	const writable_props = ['q', 'placeholder', 'accessibility', 'formAction'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Search> was created with unknown prop '${key}'`);
    	});

    	function input0_value_binding(value) {
    		searchInputValue = value;
    		$$invalidate(4, searchInputValue);
    	}

    	$$self.$$set = $$props => {
    		if ('q' in $$props) $$invalidate(0, q = $$props.q);
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    		if ('accessibility' in $$props) $$invalidate(2, accessibility = $$props.accessibility);
    		if ('formAction' in $$props) $$invalidate(3, formAction = $$props.formAction);
    	};

    	$$self.$capture_state = () => ({
    		Input,
    		Button,
    		SearchIcon: Search_icon,
    		q,
    		placeholder,
    		accessibility,
    		formAction,
    		searchInputValue,
    		doSearch
    	});

    	$$self.$inject_state = $$props => {
    		if ('q' in $$props) $$invalidate(0, q = $$props.q);
    		if ('placeholder' in $$props) $$invalidate(1, placeholder = $$props.placeholder);
    		if ('accessibility' in $$props) $$invalidate(2, accessibility = $$props.accessibility);
    		if ('formAction' in $$props) $$invalidate(3, formAction = $$props.formAction);
    		if ('searchInputValue' in $$props) $$invalidate(4, searchInputValue = $$props.searchInputValue);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		q,
    		placeholder,
    		accessibility,
    		formAction,
    		searchInputValue,
    		doSearch,
    		input0_value_binding
    	];
    }

    class Search extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$b, create_fragment$b, not_equal, {
    			q: 0,
    			placeholder: 1,
    			accessibility: 2,
    			formAction: 3
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Search",
    			options,
    			id: create_fragment$b.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*q*/ ctx[0] === undefined && !('q' in props)) {
    			console.warn("<Search> was created without expected prop 'q'");
    		}

    		if (/*placeholder*/ ctx[1] === undefined && !('placeholder' in props)) {
    			console.warn("<Search> was created without expected prop 'placeholder'");
    		}

    		if (/*accessibility*/ ctx[2] === undefined && !('accessibility' in props)) {
    			console.warn("<Search> was created without expected prop 'accessibility'");
    		}

    		if (/*formAction*/ ctx[3] === undefined && !('formAction' in props)) {
    			console.warn("<Search> was created without expected prop 'formAction'");
    		}
    	}

    	get q() {
    		throw new Error("<Search>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set q(value) {
    		throw new Error("<Search>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get placeholder() {
    		throw new Error("<Search>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set placeholder(value) {
    		throw new Error("<Search>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get accessibility() {
    		throw new Error("<Search>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set accessibility(value) {
    		throw new Error("<Search>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get formAction() {
    		throw new Error("<Search>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set formAction(value) {
    		throw new Error("<Search>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\StoreLocator\StoreLocatorPopup.svelte generated by Svelte v3.44.1 */
    const file$9 = "src\\StoreLocator\\StoreLocatorPopup.svelte";

    // (47:16) <Button class="redesign-button update-button" type="submit" value="Update" name="zipcodeentry_update"                      >
    function create_default_slot$4(ctx) {
    	let t_1_value = /*$t*/ ctx[0]('store-locator.update') + "";
    	let t_1;

    	const block = {
    		c: function create() {
    			t_1 = text(t_1_value);
    		},
    		l: function claim(nodes) {
    			t_1 = claim_text(nodes, t_1_value);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t_1, anchor);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$t*/ 1 && t_1_value !== (t_1_value = /*$t*/ ctx[0]('store-locator.update') + "")) set_data_dev(t_1, t_1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$4.name,
    		type: "slot",
    		source: "(47:16) <Button class=\\\"redesign-button update-button\\\" type=\\\"submit\\\" value=\\\"Update\\\" name=\\\"zipcodeentry_update\\\"                      >",
    		ctx
    	});

    	return block;
    }

    // (86:12) {:else}
    function create_else_block$1(ctx) {
    	let h3;
    	let t_1_value = /*$t*/ ctx[0]('store-locator.closed') + "";
    	let t_1;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t_1 = text(t_1_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			h3 = claim_element(nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t_1 = claim_text(h3_nodes, t_1_value);
    			h3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h3, "class", "closest-store-hours-closed visually-hidden svelte-f6hcch");
    			add_location(h3, file$9, 86, 16, 3528);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, h3, anchor);
    			append_hydration_dev(h3, t_1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$t*/ 1 && t_1_value !== (t_1_value = /*$t*/ ctx[0]('store-locator.closed') + "")) set_data_dev(t_1, t_1_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block$1.name,
    		type: "else",
    		source: "(86:12) {:else}",
    		ctx
    	});

    	return block;
    }

    // (82:12) {#if storeTime}
    function create_if_block$4(ctx) {
    	let h3;
    	let t0_value = /*$t*/ ctx[0]('store-locator.open') + "";
    	let t0;
    	let span;
    	let t1;

    	const block = {
    		c: function create() {
    			h3 = element("h3");
    			t0 = text(t0_value);
    			span = element("span");
    			t1 = text(/*storeTime*/ ctx[2]);
    			this.h();
    		},
    		l: function claim(nodes) {
    			h3 = claim_element(nodes, "H3", { class: true });
    			var h3_nodes = children(h3);
    			t0 = claim_text(h3_nodes, t0_value);
    			span = claim_element(h3_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t1 = claim_text(span_nodes, /*storeTime*/ ctx[2]);
    			span_nodes.forEach(detach_dev);
    			h3_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "closest-store-hours-value svelte-f6hcch");
    			add_location(span, file$9, 83, 46, 3408);
    			attr_dev(h3, "class", "closest-store-hours-open svelte-f6hcch");
    			add_location(h3, file$9, 82, 16, 3323);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, h3, anchor);
    			append_hydration_dev(h3, t0);
    			append_hydration_dev(h3, span);
    			append_hydration_dev(span, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$t*/ 1 && t0_value !== (t0_value = /*$t*/ ctx[0]('store-locator.open') + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(h3);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$4.name,
    		type: "if",
    		source: "(82:12) {#if storeTime}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$a(ctx) {
    	let div13;
    	let form;
    	let fieldset;
    	let h4;
    	let t0_value = /*$t*/ ctx[0]('store-locator.change-location') + "";
    	let t0;
    	let t1;
    	let div1;
    	let label;
    	let span0;
    	let t2_value = /*$t*/ ctx[0]('store-locator.zip') + "";
    	let t2;
    	let span1;
    	let t3;
    	let t4;
    	let div0;
    	let input0;
    	let t5;
    	let span2;
    	let t6;
    	let div2;
    	let button;
    	let t7;
    	let div12;
    	let input1;
    	let t8;
    	let div3;
    	let p;
    	let t9;
    	let span3;
    	let t10;
    	let t11;
    	let input2;
    	let t12;
    	let div9;
    	let div8;
    	let div4;
    	let t13;
    	let t14;
    	let div5;
    	let t15;
    	let t16;
    	let div6;
    	let t17;
    	let t18;
    	let div7;
    	let b0;
    	let t19_value = /*$t*/ ctx[0]('store-locator.number') + "";
    	let t19;
    	let a0;
    	let t20;
    	let t21;
    	let br;
    	let t22;
    	let b1;
    	let t23_value = /*$t*/ ctx[0]('store-locator.customer-service') + "";
    	let t23;
    	let a1;
    	let t24;
    	let t25;
    	let div10;
    	let t26;
    	let div11;
    	let a2;
    	let t27_value = /*$t*/ ctx[0]('store-locator.details') + "";
    	let t27;
    	let t28;
    	let a3;
    	let t29_value = /*$t*/ ctx[0]('store-locator.locations') + "";
    	let t29;
    	let current;

    	input0 = new Input({
    			props: {
    				class: "input-text numbers-hypen-only postal required",
    				type: "text",
    				id: "zipcodeentry_postal",
    				name: "zipcodeentry_postal",
    				value: "",
    				placeholder: /*storeZip*/ ctx[1],
    				maxlength: "5"
    			},
    			$$inline: true
    		});

    	button = new Button({
    			props: {
    				class: "redesign-button update-button",
    				type: "submit",
    				value: "Update",
    				name: "zipcodeentry_update",
    				$$slots: { default: [create_default_slot$4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	function select_block_type(ctx, dirty) {
    		if (/*storeTime*/ ctx[2]) return create_if_block$4;
    		return create_else_block$1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type(ctx);

    	const block = {
    		c: function create() {
    			div13 = element("div");
    			form = element("form");
    			fieldset = element("fieldset");
    			h4 = element("h4");
    			t0 = text(t0_value);
    			t1 = space();
    			div1 = element("div");
    			label = element("label");
    			span0 = element("span");
    			t2 = text(t2_value);
    			span1 = element("span");
    			t3 = text("*");
    			t4 = space();
    			div0 = element("div");
    			create_component(input0.$$.fragment);
    			t5 = space();
    			span2 = element("span");
    			t6 = space();
    			div2 = element("div");
    			create_component(button.$$.fragment);
    			t7 = space();
    			div12 = element("div");
    			input1 = element("input");
    			t8 = space();
    			div3 = element("div");
    			p = element("p");
    			t9 = text("store-locator.closest-to ");
    			span3 = element("span");
    			t10 = text(/*storeZip*/ ctx[1]);
    			t11 = space();
    			input2 = element("input");
    			t12 = space();
    			div9 = element("div");
    			div8 = element("div");
    			div4 = element("div");
    			t13 = text("Ashley HomeStore");
    			t14 = space();
    			div5 = element("div");
    			t15 = text("2915 N Dale Mabry Hwy");
    			t16 = space();
    			div6 = element("div");
    			t17 = text("Tampa, FL 33607");
    			t18 = space();
    			div7 = element("div");
    			b0 = element("b");
    			t19 = text(t19_value);
    			a0 = element("a");
    			t20 = text("813-940-3272");
    			t21 = space();
    			br = element("br");
    			t22 = space();
    			b1 = element("b");
    			t23 = text(t23_value);
    			a1 = element("a");
    			t24 = text("800-477-0097");
    			t25 = space();
    			div10 = element("div");
    			if_block.c();
    			t26 = space();
    			div11 = element("div");
    			a2 = element("a");
    			t27 = text(t27_value);
    			t28 = space();
    			a3 = element("a");
    			t29 = text(t29_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div13 = claim_element(nodes, "DIV", {
    				id: true,
    				class: true,
    				scrolltop: true,
    				scrollleft: true,
    				style: true
    			});

    			var div13_nodes = children(div13);

    			form = claim_element(div13_nodes, "FORM", {
    				action: true,
    				method: true,
    				id: true,
    				class: true
    			});

    			var form_nodes = children(form);
    			fieldset = claim_element(form_nodes, "FIELDSET", { class: true });
    			var fieldset_nodes = children(fieldset);
    			h4 = claim_element(fieldset_nodes, "H4", { class: true });
    			var h4_nodes = children(h4);
    			t0 = claim_text(h4_nodes, t0_value);
    			h4_nodes.forEach(detach_dev);
    			t1 = claim_space(fieldset_nodes);
    			div1 = claim_element(fieldset_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			label = claim_element(div1_nodes, "LABEL", { for: true, id: true, class: true });
    			var label_nodes = children(label);
    			span0 = claim_element(label_nodes, "SPAN", { class: true });
    			var span0_nodes = children(span0);
    			t2 = claim_text(span0_nodes, t2_value);
    			span0_nodes.forEach(detach_dev);
    			span1 = claim_element(label_nodes, "SPAN", { class: true });
    			var span1_nodes = children(span1);
    			t3 = claim_text(span1_nodes, "*");
    			span1_nodes.forEach(detach_dev);
    			label_nodes.forEach(detach_dev);
    			t4 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(input0.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t5 = claim_space(div1_nodes);
    			span2 = claim_element(div1_nodes, "SPAN", { class: true, id: true });
    			children(span2).forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t6 = claim_space(fieldset_nodes);
    			div2 = claim_element(fieldset_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			claim_component(button.$$.fragment, div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			fieldset_nodes.forEach(detach_dev);
    			form_nodes.forEach(detach_dev);
    			t7 = claim_space(div13_nodes);
    			div12 = claim_element(div13_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);

    			input1 = claim_element(div12_nodes, "INPUT", {
    				type: true,
    				name: true,
    				id: true,
    				class: true
    			});

    			t8 = claim_space(div12_nodes);
    			div3 = claim_element(div12_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			p = claim_element(div3_nodes, "P", { class: true });
    			var p_nodes = children(p);
    			t9 = claim_text(p_nodes, "store-locator.closest-to ");
    			span3 = claim_element(p_nodes, "SPAN", { class: true });
    			var span3_nodes = children(span3);
    			t10 = claim_text(span3_nodes, /*storeZip*/ ctx[1]);
    			span3_nodes.forEach(detach_dev);
    			p_nodes.forEach(detach_dev);
    			t11 = claim_space(div3_nodes);
    			input2 = claim_element(div3_nodes, "INPUT", { type: true, id: true, class: true });
    			div3_nodes.forEach(detach_dev);
    			t12 = claim_space(div12_nodes);
    			div9 = claim_element(div12_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div4 = claim_element(div8_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			t13 = claim_text(div4_nodes, "Ashley HomeStore");
    			div4_nodes.forEach(detach_dev);
    			t14 = claim_space(div8_nodes);
    			div5 = claim_element(div8_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			t15 = claim_text(div5_nodes, "2915 N Dale Mabry Hwy");
    			div5_nodes.forEach(detach_dev);
    			t16 = claim_space(div8_nodes);
    			div6 = claim_element(div8_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			t17 = claim_text(div6_nodes, "Tampa, FL 33607");
    			div6_nodes.forEach(detach_dev);
    			t18 = claim_space(div8_nodes);
    			div7 = claim_element(div8_nodes, "DIV", { id: true, class: true });
    			var div7_nodes = children(div7);
    			b0 = claim_element(div7_nodes, "B", { class: true });
    			var b0_nodes = children(b0);
    			t19 = claim_text(b0_nodes, t19_value);
    			b0_nodes.forEach(detach_dev);
    			a0 = claim_element(div7_nodes, "A", { href: true, class: true });
    			var a0_nodes = children(a0);
    			t20 = claim_text(a0_nodes, "813-940-3272");
    			a0_nodes.forEach(detach_dev);
    			t21 = claim_space(div7_nodes);
    			br = claim_element(div7_nodes, "BR", { class: true });
    			t22 = claim_space(div7_nodes);
    			b1 = claim_element(div7_nodes, "B", { class: true });
    			var b1_nodes = children(b1);
    			t23 = claim_text(b1_nodes, t23_value);
    			b1_nodes.forEach(detach_dev);
    			a1 = claim_element(div7_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			t24 = claim_text(a1_nodes, "800-477-0097");
    			a1_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			t25 = claim_space(div12_nodes);
    			div10 = claim_element(div12_nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			if_block.l(div10_nodes);
    			div10_nodes.forEach(detach_dev);
    			t26 = claim_space(div12_nodes);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			a2 = claim_element(div11_nodes, "A", { class: true, href: true, target: true });
    			var a2_nodes = children(a2);
    			t27 = claim_text(a2_nodes, t27_value);
    			a2_nodes.forEach(detach_dev);
    			t28 = claim_space(div11_nodes);
    			a3 = claim_element(div11_nodes, "A", { class: true, href: true, target: true });
    			var a3_nodes = children(a3);
    			t29 = claim_text(a3_nodes, t29_value);
    			a3_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			div13_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h4, "class", "svelte-f6hcch");
    			add_location(h4, file$9, 23, 12, 741);
    			attr_dev(span0, "class", "svelte-f6hcch");
    			add_location(span0, file$9, 27, 21, 938);
    			attr_dev(span1, "class", "required-indicator svelte-f6hcch");
    			add_location(span1, file$9, 27, 59, 976);
    			attr_dev(label, "for", "zipcodeentry_postal");
    			attr_dev(label, "id", "zipcodeentry_postal-label");
    			attr_dev(label, "class", "svelte-f6hcch");
    			add_location(label, file$9, 26, 16, 852);
    			attr_dev(div0, "class", "field-wrapper svelte-f6hcch");
    			add_location(div0, file$9, 30, 16, 1063);
    			attr_dev(span2, "class", "form-caption svelte-f6hcch");
    			attr_dev(span2, "id", "zipcodeentry_postal-desc");
    			add_location(span2, file$9, 42, 16, 1525);
    			attr_dev(div1, "class", "form-row required svelte-f6hcch");
    			add_location(div1, file$9, 25, 12, 803);
    			attr_dev(div2, "class", "form-row form-row-button form-row-bottom-zero svelte-f6hcch");
    			add_location(div2, file$9, 45, 12, 1620);
    			attr_dev(fieldset, "class", "svelte-f6hcch");
    			add_location(fieldset, file$9, 22, 8, 717);
    			attr_dev(form, "action", "https://www.ashleyfurniture.com/on/demandware.store/Sites-Ashley-US-Site/default/CustomerPersonalization-SetZipCode");
    			attr_dev(form, "method", "post");
    			attr_dev(form, "id", "zip-code-entry-form");
    			attr_dev(form, "class", "zip-code-entry-form svelte-f6hcch");
    			add_location(form, file$9, 16, 4, 467);
    			attr_dev(input1, "type", "hidden");
    			attr_dev(input1, "name", "closest-store-hours-html");
    			attr_dev(input1, "id", "closest-store-hours-html");
    			input1.value = "Mon: 11:00AM-07:00PM <br/>Tue: 11:00AM-07:00PM <br/>Wed: 11:00AM-07:00PM <br/>Thu: 11:00AM-07:00PM <br/>Fri: 11:00AM-07:00PM <br/>Sat: 11:00AM-07:00PM <br/>Sun: 11:00AM-07:00PM";
    			attr_dev(input1, "class", "svelte-f6hcch");
    			add_location(input1, file$9, 54, 8, 1980);
    			attr_dev(span3, "class", "svelte-f6hcch");
    			add_location(span3, file$9, 62, 40, 2400);
    			attr_dev(p, "class", "svelte-f6hcch");
    			add_location(p, file$9, 62, 12, 2372);
    			attr_dev(input2, "type", "hidden");
    			attr_dev(input2, "id", "is-today-closed");
    			input2.value = "null";
    			attr_dev(input2, "class", "svelte-f6hcch");
    			add_location(input2, file$9, 63, 12, 2441);
    			attr_dev(div3, "class", "closest-store-heading svelte-f6hcch");
    			add_location(div3, file$9, 61, 8, 2323);
    			attr_dev(div4, "class", "closest-store-name svelte-f6hcch");
    			add_location(div4, file$9, 68, 16, 2633);
    			attr_dev(div5, "class", "closest-store-address svelte-f6hcch");
    			add_location(div5, file$9, 69, 16, 2705);
    			attr_dev(div6, "class", "closest-store-citystatezip svelte-f6hcch");
    			add_location(div6, file$9, 70, 16, 2785);
    			attr_dev(b0, "class", "svelte-f6hcch");
    			add_location(b0, file$9, 73, 20, 2953);
    			attr_dev(a0, "href", "tel:+18139403272");
    			attr_dev(a0, "class", "svelte-f6hcch");
    			add_location(a0, file$9, 73, 56, 2989);
    			attr_dev(br, "class", "svelte-f6hcch");
    			add_location(br, file$9, 74, 20, 3054);
    			attr_dev(b1, "class", "svelte-f6hcch");
    			add_location(b1, file$9, 75, 20, 3082);
    			attr_dev(a1, "href", "tel:+18004770097");
    			attr_dev(a1, "class", "svelte-f6hcch");
    			add_location(a1, file$9, 75, 66, 3128);
    			attr_dev(div7, "id", "closest-store-phone-number");
    			attr_dev(div7, "class", "closest-store-phone svelte-f6hcch");
    			add_location(div7, file$9, 72, 16, 2866);
    			attr_dev(div8, "class", "closest-store-address-text svelte-f6hcch");
    			add_location(div8, file$9, 67, 12, 2575);
    			attr_dev(div9, "class", "closest-store-address svelte-f6hcch");
    			add_location(div9, file$9, 66, 8, 2526);
    			attr_dev(div10, "class", "closest-store-hours svelte-f6hcch");
    			add_location(div10, file$9, 80, 8, 3243);
    			attr_dev(a2, "class", "redesign-button svelte-f6hcch");
    			attr_dev(a2, "href", "https://stores.ashleyfurniture.com/store/us/florida/tampa/7710000102");
    			attr_dev(a2, "target", "blank");
    			add_location(a2, file$9, 91, 12, 3710);
    			attr_dev(a3, "class", "redesign-button svelte-f6hcch");
    			attr_dev(a3, "href", "https://stores.ashleyfurniture.com/");
    			attr_dev(a3, "target", "blank");
    			add_location(a3, file$9, 96, 12, 3940);
    			attr_dev(div11, "class", "closest-store-links svelte-f6hcch");
    			add_location(div11, file$9, 90, 8, 3663);
    			attr_dev(div12, "class", "closest-store-wrap svelte-f6hcch");
    			add_location(div12, file$9, 53, 4, 1938);
    			attr_dev(div13, "id", "LocalPricingDialog");
    			attr_dev(div13, "class", "dialog-content ui-dialog-content ui-widget-content svelte-f6hcch");
    			attr_dev(div13, "scrolltop", "0");
    			attr_dev(div13, "scrollleft", "0");
    			set_style(div13, "width", "auto");
    			set_style(div13, "min-height", "98px");
    			set_style(div13, "height", "auto");
    			add_location(div13, file$9, 9, 0, 264);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div13, anchor);
    			append_hydration_dev(div13, form);
    			append_hydration_dev(form, fieldset);
    			append_hydration_dev(fieldset, h4);
    			append_hydration_dev(h4, t0);
    			append_hydration_dev(fieldset, t1);
    			append_hydration_dev(fieldset, div1);
    			append_hydration_dev(div1, label);
    			append_hydration_dev(label, span0);
    			append_hydration_dev(span0, t2);
    			append_hydration_dev(label, span1);
    			append_hydration_dev(span1, t3);
    			append_hydration_dev(div1, t4);
    			append_hydration_dev(div1, div0);
    			mount_component(input0, div0, null);
    			append_hydration_dev(div1, t5);
    			append_hydration_dev(div1, span2);
    			append_hydration_dev(fieldset, t6);
    			append_hydration_dev(fieldset, div2);
    			mount_component(button, div2, null);
    			append_hydration_dev(div13, t7);
    			append_hydration_dev(div13, div12);
    			append_hydration_dev(div12, input1);
    			append_hydration_dev(div12, t8);
    			append_hydration_dev(div12, div3);
    			append_hydration_dev(div3, p);
    			append_hydration_dev(p, t9);
    			append_hydration_dev(p, span3);
    			append_hydration_dev(span3, t10);
    			append_hydration_dev(div3, t11);
    			append_hydration_dev(div3, input2);
    			append_hydration_dev(div12, t12);
    			append_hydration_dev(div12, div9);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div4);
    			append_hydration_dev(div4, t13);
    			append_hydration_dev(div8, t14);
    			append_hydration_dev(div8, div5);
    			append_hydration_dev(div5, t15);
    			append_hydration_dev(div8, t16);
    			append_hydration_dev(div8, div6);
    			append_hydration_dev(div6, t17);
    			append_hydration_dev(div8, t18);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, b0);
    			append_hydration_dev(b0, t19);
    			append_hydration_dev(div7, a0);
    			append_hydration_dev(a0, t20);
    			append_hydration_dev(div7, t21);
    			append_hydration_dev(div7, br);
    			append_hydration_dev(div7, t22);
    			append_hydration_dev(div7, b1);
    			append_hydration_dev(b1, t23);
    			append_hydration_dev(div7, a1);
    			append_hydration_dev(a1, t24);
    			append_hydration_dev(div12, t25);
    			append_hydration_dev(div12, div10);
    			if_block.m(div10, null);
    			append_hydration_dev(div12, t26);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, a2);
    			append_hydration_dev(a2, t27);
    			append_hydration_dev(div11, t28);
    			append_hydration_dev(div11, a3);
    			append_hydration_dev(a3, t29);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*$t*/ 1) && t0_value !== (t0_value = /*$t*/ ctx[0]('store-locator.change-location') + "")) set_data_dev(t0, t0_value);
    			if ((!current || dirty & /*$t*/ 1) && t2_value !== (t2_value = /*$t*/ ctx[0]('store-locator.zip') + "")) set_data_dev(t2, t2_value);
    			const button_changes = {};

    			if (dirty & /*$$scope, $t*/ 9) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);
    			if ((!current || dirty & /*$t*/ 1) && t19_value !== (t19_value = /*$t*/ ctx[0]('store-locator.number') + "")) set_data_dev(t19, t19_value);
    			if ((!current || dirty & /*$t*/ 1) && t23_value !== (t23_value = /*$t*/ ctx[0]('store-locator.customer-service') + "")) set_data_dev(t23, t23_value);
    			if_block.p(ctx, dirty);
    			if ((!current || dirty & /*$t*/ 1) && t27_value !== (t27_value = /*$t*/ ctx[0]('store-locator.details') + "")) set_data_dev(t27, t27_value);
    			if ((!current || dirty & /*$t*/ 1) && t29_value !== (t29_value = /*$t*/ ctx[0]('store-locator.locations') + "")) set_data_dev(t29, t29_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(input0.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(input0.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div13);
    			destroy_component(input0);
    			destroy_component(button);
    			if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let $t;
    	validate_store($format, 't');
    	component_subscribe($$self, $format, $$value => $$invalidate(0, $t = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('StoreLocatorPopup', slots, []);
    	let storeZip = getContext('storeZip');
    	let storeTime = getContext('storeTime');
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<StoreLocatorPopup> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		getContext,
    		Input,
    		Button,
    		t: $format,
    		storeZip,
    		storeTime,
    		$t
    	});

    	$$self.$inject_state = $$props => {
    		if ('storeZip' in $$props) $$invalidate(1, storeZip = $$props.storeZip);
    		if ('storeTime' in $$props) $$invalidate(2, storeTime = $$props.storeTime);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [$t, storeZip, storeTime];
    }

    class StoreLocatorPopup extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$a, create_fragment$a, not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StoreLocatorPopup",
    			options,
    			id: create_fragment$a.name
    		});
    	}
    }

    /* src\StoreLocator\StoreLocator.svelte generated by Svelte v3.44.1 */
    const file$8 = "src\\StoreLocator\\StoreLocator.svelte";

    // (64:16) <Content popupContent={content}>
    function create_default_slot_1$1(ctx) {
    	let arrowcarousellefticon;
    	let current;
    	arrowcarousellefticon = new Arrow_carousel_left_icon({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(arrowcarousellefticon.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(arrowcarousellefticon.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(arrowcarousellefticon, target, anchor);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(arrowcarousellefticon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(arrowcarousellefticon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(arrowcarousellefticon, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1$1.name,
    		type: "slot",
    		source: "(64:16) <Content popupContent={content}>",
    		ctx
    	});

    	return block;
    }

    // (63:12) <Modal show={$modal} closeOnEsc={false} {styleCloseButton} {styleContent} {styleWindow} {styleWindowWrap}>
    function create_default_slot$3(ctx) {
    	let content_1;
    	let current;

    	content_1 = new Content({
    			props: {
    				popupContent: StoreLocatorPopup,
    				$$slots: { default: [create_default_slot_1$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(content_1.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(content_1.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(content_1, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const content_1_changes = {};

    			if (dirty & /*$$scope*/ 65536) {
    				content_1_changes.$$scope = { dirty, ctx };
    			}

    			content_1.$set(content_1_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(content_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(content_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(content_1, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$3.name,
    		type: "slot",
    		source: "(63:12) <Modal show={$modal} closeOnEsc={false} {styleCloseButton} {styleContent} {styleWindow} {styleWindowWrap}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$9(ctx) {
    	let div5;
    	let div4;
    	let input0;
    	let t0;
    	let div0;
    	let t1;
    	let t2;
    	let div1;
    	let t3;
    	let t4;
    	let div2;
    	let modal_1;
    	let t5;
    	let div3;
    	let t6;
    	let t7;
    	let input1;
    	let current;

    	modal_1 = new Modal({
    			props: {
    				show: /*$modal*/ ctx[3],
    				closeOnEsc: false,
    				styleCloseButton: /*styleCloseButton*/ ctx[7],
    				styleContent: /*styleContent*/ ctx[6],
    				styleWindow: /*styleWindow*/ ctx[5],
    				styleWindowWrap: /*styleWindowWrap*/ ctx[4],
    				$$slots: { default: [create_default_slot$3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div5 = element("div");
    			div4 = element("div");
    			input0 = element("input");
    			t0 = space();
    			div0 = element("div");
    			t1 = text("store-locator.closest");
    			t2 = space();
    			div1 = element("div");
    			t3 = text(/*storeName*/ ctx[0]);
    			t4 = space();
    			div2 = element("div");
    			create_component(modal_1.$$.fragment);
    			t5 = space();
    			div3 = element("div");
    			t6 = text(/*storeMessage*/ ctx[2]);
    			t7 = space();
    			input1 = element("input");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div5 = claim_element(nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			input0 = claim_element(div4_nodes, "INPUT", { type: true, class: true });
    			t0 = claim_space(div4_nodes);
    			div0 = claim_element(div4_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			t1 = claim_text(div0_nodes, "store-locator.closest");
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(div4_nodes);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			t3 = claim_text(div1_nodes, /*storeName*/ ctx[0]);
    			div1_nodes.forEach(detach_dev);
    			t4 = claim_space(div4_nodes);
    			div2 = claim_element(div4_nodes, "DIV", { id: true, class: true, "data-href": true });
    			var div2_nodes = children(div2);
    			claim_component(modal_1.$$.fragment, div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			t5 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			t6 = claim_text(div3_nodes, /*storeMessage*/ ctx[2]);
    			div3_nodes.forEach(detach_dev);
    			t7 = claim_space(div4_nodes);
    			input1 = claim_element(div4_nodes, "INPUT", { type: true, name: true, class: true });
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(input0, "type", "hidden");
    			attr_dev(input0, "class", "is_today_closed svelte-2hw04a");
    			input0.value = "null";
    			add_location(input0, file$8, 52, 8, 1520);
    			attr_dev(div0, "class", "local-pricing-label svelte-2hw04a");
    			add_location(div0, file$8, 53, 8, 1590);
    			attr_dev(div1, "class", "local-pricing-zip-code svelte-2hw04a");
    			add_location(div1, file$8, 56, 8, 1684);
    			attr_dev(div2, "id", "js-local-pricing-link");
    			attr_dev(div2, "class", "js-local-pricing-link local-pricing-link svelte-2hw04a");
    			attr_dev(div2, "data-href", "/on/demandware.store/Sites-Ashley-US-Site/default/CustomerPersonalization-EnterZipCode?fullContent=true");
    			add_location(div2, file$8, 57, 8, 1747);
    			attr_dev(div3, "class", "local-pricing-label hours svelte-2hw04a");
    			add_location(div3, file$8, 68, 8, 2286);
    			attr_dev(input1, "type", "hidden");
    			attr_dev(input1, "name", "userZipCode");
    			input1.value = /*storeZip*/ ctx[1];
    			attr_dev(input1, "class", "svelte-2hw04a");
    			add_location(input1, file$8, 69, 8, 2355);
    			attr_dev(div4, "class", "local-pricing-status-container svelte-2hw04a");
    			add_location(div4, file$8, 51, 4, 1466);
    			attr_dev(div5, "class", "header-local-pricing svelte-2hw04a");
    			add_location(div5, file$8, 50, 0, 1426);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div5, anchor);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, input0);
    			append_hydration_dev(div4, t0);
    			append_hydration_dev(div4, div0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div4, t2);
    			append_hydration_dev(div4, div1);
    			append_hydration_dev(div1, t3);
    			append_hydration_dev(div4, t4);
    			append_hydration_dev(div4, div2);
    			mount_component(modal_1, div2, null);
    			append_hydration_dev(div4, t5);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, t6);
    			append_hydration_dev(div4, t7);
    			append_hydration_dev(div4, input1);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*storeName*/ 1) set_data_dev(t3, /*storeName*/ ctx[0]);
    			const modal_1_changes = {};
    			if (dirty & /*$modal*/ 8) modal_1_changes.show = /*$modal*/ ctx[3];

    			if (dirty & /*$$scope*/ 65536) {
    				modal_1_changes.$$scope = { dirty, ctx };
    			}

    			modal_1.$set(modal_1_changes);
    			if (!current || dirty & /*storeMessage*/ 4) set_data_dev(t6, /*storeMessage*/ ctx[2]);

    			if (!current || dirty & /*storeZip*/ 2) {
    				prop_dev(input1, "value", /*storeZip*/ ctx[1]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(modal_1.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(modal_1.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div5);
    			destroy_component(modal_1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let $modal;
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('StoreLocator', slots, []);
    	let { storeName, storeHours, storeZip, storeTime } = $$props;

    	let storeMessage = '',
    		currentHour = new Date().getHours(),
    		thisCloseTime = storeTime,
    		thisStoreHours = storeHours,
    		openTime = parseInt(thisStoreHours.replace(/[A-Z]/g, ''), 10),
    		closeTime = parseInt(thisCloseTime, 10) + 12;

    	if (currentHour >= openTime && currentHour <= closeTime) {
    		storeMessage = 'OPEN UNTIL ' + storeTime;
    	} else {
    		storeMessage = storeHours;
    	}

    	setContext('storeZip', storeZip);
    	setContext('storeTime', storeTime);
    	let styleWindowWrap = { paddingTop: '40px;' };
    	let styleWindow = { width: '300px;', borderRadius: '0px;' };
    	let styleContent = { padding: '30px 20px;' };

    	let styleCloseButton = {
    		color: '$black;',
    		transition: 'none;',
    		border: 'none;',
    		borderRadius: '0px;',
    		boxShadow: 'none;',
    		cursor: 'pointer;'
    	};

    	const modal = writable(null);
    	validate_store(modal, 'modal');
    	component_subscribe($$self, modal, value => $$invalidate(3, $modal = value));
    	const writable_props = ['storeName', 'storeHours', 'storeZip', 'storeTime'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<StoreLocator> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('storeName' in $$props) $$invalidate(0, storeName = $$props.storeName);
    		if ('storeHours' in $$props) $$invalidate(9, storeHours = $$props.storeHours);
    		if ('storeZip' in $$props) $$invalidate(1, storeZip = $$props.storeZip);
    		if ('storeTime' in $$props) $$invalidate(10, storeTime = $$props.storeTime);
    	};

    	$$self.$capture_state = () => ({
    		setContext,
    		ArrowCarouselLeftIcon: Arrow_carousel_left_icon,
    		Content,
    		Modal,
    		writable,
    		t: $format,
    		content: StoreLocatorPopup,
    		storeName,
    		storeHours,
    		storeZip,
    		storeTime,
    		storeMessage,
    		currentHour,
    		thisCloseTime,
    		thisStoreHours,
    		openTime,
    		closeTime,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		modal,
    		$modal
    	});

    	$$self.$inject_state = $$props => {
    		if ('storeName' in $$props) $$invalidate(0, storeName = $$props.storeName);
    		if ('storeHours' in $$props) $$invalidate(9, storeHours = $$props.storeHours);
    		if ('storeZip' in $$props) $$invalidate(1, storeZip = $$props.storeZip);
    		if ('storeTime' in $$props) $$invalidate(10, storeTime = $$props.storeTime);
    		if ('storeMessage' in $$props) $$invalidate(2, storeMessage = $$props.storeMessage);
    		if ('currentHour' in $$props) currentHour = $$props.currentHour;
    		if ('thisCloseTime' in $$props) thisCloseTime = $$props.thisCloseTime;
    		if ('thisStoreHours' in $$props) thisStoreHours = $$props.thisStoreHours;
    		if ('openTime' in $$props) openTime = $$props.openTime;
    		if ('closeTime' in $$props) closeTime = $$props.closeTime;
    		if ('styleWindowWrap' in $$props) $$invalidate(4, styleWindowWrap = $$props.styleWindowWrap);
    		if ('styleWindow' in $$props) $$invalidate(5, styleWindow = $$props.styleWindow);
    		if ('styleContent' in $$props) $$invalidate(6, styleContent = $$props.styleContent);
    		if ('styleCloseButton' in $$props) $$invalidate(7, styleCloseButton = $$props.styleCloseButton);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		storeName,
    		storeZip,
    		storeMessage,
    		$modal,
    		styleWindowWrap,
    		styleWindow,
    		styleContent,
    		styleCloseButton,
    		modal,
    		storeHours,
    		storeTime
    	];
    }

    class StoreLocator extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$9, create_fragment$9, not_equal, {
    			storeName: 0,
    			storeHours: 9,
    			storeZip: 1,
    			storeTime: 10
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StoreLocator",
    			options,
    			id: create_fragment$9.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*storeName*/ ctx[0] === undefined && !('storeName' in props)) {
    			console.warn("<StoreLocator> was created without expected prop 'storeName'");
    		}

    		if (/*storeHours*/ ctx[9] === undefined && !('storeHours' in props)) {
    			console.warn("<StoreLocator> was created without expected prop 'storeHours'");
    		}

    		if (/*storeZip*/ ctx[1] === undefined && !('storeZip' in props)) {
    			console.warn("<StoreLocator> was created without expected prop 'storeZip'");
    		}

    		if (/*storeTime*/ ctx[10] === undefined && !('storeTime' in props)) {
    			console.warn("<StoreLocator> was created without expected prop 'storeTime'");
    		}
    	}

    	get storeName() {
    		throw new Error("<StoreLocator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set storeName(value) {
    		throw new Error("<StoreLocator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get storeHours() {
    		throw new Error("<StoreLocator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set storeHours(value) {
    		throw new Error("<StoreLocator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get storeZip() {
    		throw new Error("<StoreLocator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set storeZip(value) {
    		throw new Error("<StoreLocator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get storeTime() {
    		throw new Error("<StoreLocator>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set storeTime(value) {
    		throw new Error("<StoreLocator>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Logo\Logo.svelte generated by Svelte v3.44.1 */
    const file$7 = "src\\Logo\\Logo.svelte";

    function create_fragment$8(ctx) {
    	let div;
    	let a;
    	let contentasset;
    	let current;

    	contentasset = new ContentAsset({
    			props: { contentHTML: /*contentHTML*/ ctx[0] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			create_component(contentasset.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			a = claim_element(div_nodes, "A", { href: true, title: true });
    			var a_nodes = children(a);
    			claim_component(contentasset.$$.fragment, a_nodes);
    			a_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", "https://www.ashleyfurniture.com");
    			attr_dev(a, "title", "Ashley Furniture HomeStore Home");
    			add_location(a, file$7, 6, 4, 141);
    			attr_dev(div, "class", "primary-logo svelte-n82ceb");
    			add_location(div, file$7, 5, 0, 109);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, a);
    			mount_component(contentasset, a, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const contentasset_changes = {};
    			if (dirty & /*contentHTML*/ 1) contentasset_changes.contentHTML = /*contentHTML*/ ctx[0];
    			contentasset.$set(contentasset_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(contentasset.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(contentasset.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(contentasset);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Logo', slots, []);
    	let { contentHTML } = $$props;
    	const writable_props = ['contentHTML'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Logo> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('contentHTML' in $$props) $$invalidate(0, contentHTML = $$props.contentHTML);
    	};

    	$$self.$capture_state = () => ({ ContentAsset, contentHTML });

    	$$self.$inject_state = $$props => {
    		if ('contentHTML' in $$props) $$invalidate(0, contentHTML = $$props.contentHTML);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [contentHTML];
    }

    class Logo extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$8, create_fragment$8, not_equal, { contentHTML: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Logo",
    			options,
    			id: create_fragment$8.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*contentHTML*/ ctx[0] === undefined && !('contentHTML' in props)) {
    			console.warn("<Logo> was created without expected prop 'contentHTML'");
    		}
    	}

    	get contentHTML() {
    		throw new Error("<Logo>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contentHTML(value) {
    		throw new Error("<Logo>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const showOverlay = writable(false);

    /* src\Meganav\Meganav.svelte generated by Svelte v3.44.1 */
    const file$6 = "src\\Meganav\\Meganav.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	child_ctx[10] = list;
    	child_ctx[11] = i;
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[12] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[15] = list[i];
    	return child_ctx;
    }

    function get_each_context_3(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[18] = list[i];
    	return child_ctx;
    }

    // (28:4) {#if links.length}
    function create_if_block$3(ctx) {
    	let ul;
    	let current;
    	let each_value = /*links*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			ul = claim_element(nodes, "UL", { class: true });
    			var ul_nodes = children(ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ul_nodes);
    			}

    			ul_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(ul, "class", "menu-category svelte-3ez6rp");
    			add_location(ul, file$6, 28, 8, 1139);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*links, showOverlay, undefined, showCategories*/ 5) {
    				each_value = /*links*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$3.name,
    		type: "if",
    		source: "(28:4) {#if links.length}",
    		ctx
    	});

    	return block;
    }

    // (44:20) {#if link.columns != undefined}
    function create_if_block_1$2(ctx) {
    	let div;
    	let each_value = /*each_value*/ ctx[10];
    	let link_index = /*link_index*/ ctx[11];
    	let current;
    	let mounted;
    	let dispose;
    	let each_value_1 = /*link*/ ctx[9].columns;
    	validate_each_argument(each_value_1);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const assign_div = () => /*div_binding*/ ctx[5](div, each_value, link_index);
    	const unassign_div = () => /*div_binding*/ ctx[5](null, each_value, link_index);

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", {
    				class: true,
    				"data-container-level": true
    			});

    			var div_nodes = children(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div_nodes);
    			}

    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "level-2 svelte-3ez6rp");
    			attr_dev(div, "data-container-level", "2");
    			add_location(div, file$6, 44, 24, 1970);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			assign_div();
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div, "mouseenter", /*mouseenter_handler*/ ctx[6], false, false, false),
    					listen_dev(div, "mouseleave", /*mouseleave_handler_1*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*links, undefined*/ 1) {
    				each_value_1 = /*link*/ ctx[9].columns;
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_1(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (each_value !== /*each_value*/ ctx[10] || link_index !== /*link_index*/ ctx[11]) {
    				unassign_div();
    				each_value = /*each_value*/ ctx[10];
    				link_index = /*link_index*/ ctx[11];
    				assign_div();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    			unassign_div();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$2.name,
    		type: "if",
    		source: "(44:20) {#if link.columns != undefined}",
    		ctx
    	});

    	return block;
    }

    // (53:32) {#if col.length}
    function create_if_block_2$1(ctx) {
    	let div;
    	let t;
    	let current;
    	let each_value_2 = /*col*/ ctx[12];
    	validate_each_argument(each_value_2);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_2.length; i += 1) {
    		each_blocks[i] = create_each_block_2(get_each_context_2(ctx, each_value_2, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			div = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div_nodes);
    			}

    			t = claim_space(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "menu-col svelte-3ez6rp");
    			add_location(div, file$6, 53, 36, 2461);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div, null);
    			}

    			append_hydration_dev(div, t);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*links, undefined*/ 1) {
    				each_value_2 = /*col*/ ctx[12];
    				validate_each_argument(each_value_2);
    				let i;

    				for (i = 0; i < each_value_2.length; i += 1) {
    					const child_ctx = get_each_context_2(ctx, each_value_2, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_2(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(div, t);
    					}
    				}

    				group_outros();

    				for (i = each_value_2.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_2.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2$1.name,
    		type: "if",
    		source: "(53:32) {#if col.length}",
    		ctx
    	});

    	return block;
    }

    // (66:48) {#if subCats.subcategories != undefined}
    function create_if_block_3$1(ctx) {
    	let ul;
    	let current;
    	let each_value_3 = /*subCats*/ ctx[15].subcategories;
    	validate_each_argument(each_value_3);
    	let each_blocks = [];

    	for (let i = 0; i < each_value_3.length; i += 1) {
    		each_blocks[i] = create_each_block_3(get_each_context_3(ctx, each_value_3, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			ul = claim_element(nodes, "UL", { class: true });
    			var ul_nodes = children(ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ul_nodes);
    			}

    			ul_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(ul, "class", "menu-vertical key-accessible svelte-3ez6rp");
    			add_location(ul, file$6, 66, 52, 3417);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*links*/ 1) {
    				each_value_3 = /*subCats*/ ctx[15].subcategories;
    				validate_each_argument(each_value_3);
    				let i;

    				for (i = 0; i < each_value_3.length; i += 1) {
    					const child_ctx = get_each_context_3(ctx, each_value_3, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block_3(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_3.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value_3.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3$1.name,
    		type: "if",
    		source: "(66:48) {#if subCats.subcategories != undefined}",
    		ctx
    	});

    	return block;
    }

    // (69:60) <ListItem>
    function create_default_slot_1(ctx) {
    	let a;
    	let t_value = /*subCat*/ ctx[18].name + "";
    	let t;
    	let a_href_value;
    	let a_data_cgid_value;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t = text(t_value);
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				href: true,
    				"data-level": true,
    				"data-cgid": true,
    				target: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			t = claim_text(a_nodes, t_value);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", a_href_value = /*subCat*/ ctx[18].path);
    			attr_dev(a, "data-level", "2");
    			attr_dev(a, "data-cgid", a_data_cgid_value = /*subCat*/ ctx[18].pathId);
    			attr_dev(a, "target", "_self");
    			attr_dev(a, "class", "svelte-3ez6rp");
    			add_location(a, file$6, 69, 64, 3693);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, t);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*links*/ 1 && t_value !== (t_value = /*subCat*/ ctx[18].name + "")) set_data_dev(t, t_value);

    			if (dirty & /*links*/ 1 && a_href_value !== (a_href_value = /*subCat*/ ctx[18].path)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (dirty & /*links*/ 1 && a_data_cgid_value !== (a_data_cgid_value = /*subCat*/ ctx[18].pathId)) {
    				attr_dev(a, "data-cgid", a_data_cgid_value);
    			}
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(69:60) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (68:56) {#each subCats.subcategories as subCat}
    function create_each_block_3(ctx) {
    	let listitem;
    	let current;

    	listitem = new ListItem({
    			props: {
    				$$slots: { default: [create_default_slot_1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(listitem.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(listitem.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(listitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const listitem_changes = {};

    			if (dirty & /*$$scope, links*/ 2097153) {
    				listitem_changes.$$scope = { dirty, ctx };
    			}

    			listitem.$set(listitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(listitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(listitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(listitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_3.name,
    		type: "each",
    		source: "(68:56) {#each subCats.subcategories as subCat}",
    		ctx
    	});

    	return block;
    }

    // (55:40) {#each col as subCats}
    function create_each_block_2(ctx) {
    	let div;
    	let a;
    	let t0_value = /*subCats*/ ctx[15].name + "";
    	let t0;
    	let a_href_value;
    	let a_data_cgid_value;
    	let t1;
    	let current;
    	let if_block = /*subCats*/ ctx[15].subcategories != undefined && create_if_block_3$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", {});
    			var div_nodes = children(div);

    			a = claim_element(div_nodes, "A", {
    				href: true,
    				class: true,
    				"data-level": true,
    				"data-cgid": true,
    				target: true
    			});

    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, t0_value);
    			a_nodes.forEach(detach_dev);
    			t1 = claim_space(div_nodes);
    			if (if_block) if_block.l(div_nodes);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", a_href_value = /*subCats*/ ctx[15].path);
    			attr_dev(a, "class", "main-category svelte-3ez6rp");
    			attr_dev(a, "data-level", "2");
    			attr_dev(a, "data-cgid", a_data_cgid_value = /*subCats*/ ctx[15].pathId);
    			attr_dev(a, "target", "_self");
    			toggle_class(a, "has-sub-menu", /*subCats*/ ctx[15].subcategories && /*subCats*/ ctx[15].subcategories.length > 1);
    			add_location(a, file$6, 56, 48, 2648);
    			add_location(div, file$6, 55, 44, 2593);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, a);
    			append_hydration_dev(a, t0);
    			append_hydration_dev(div, t1);
    			if (if_block) if_block.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*links*/ 1) && t0_value !== (t0_value = /*subCats*/ ctx[15].name + "")) set_data_dev(t0, t0_value);

    			if (!current || dirty & /*links*/ 1 && a_href_value !== (a_href_value = /*subCats*/ ctx[15].path)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (!current || dirty & /*links*/ 1 && a_data_cgid_value !== (a_data_cgid_value = /*subCats*/ ctx[15].pathId)) {
    				attr_dev(a, "data-cgid", a_data_cgid_value);
    			}

    			if (dirty & /*links*/ 1) {
    				toggle_class(a, "has-sub-menu", /*subCats*/ ctx[15].subcategories && /*subCats*/ ctx[15].subcategories.length > 1);
    			}

    			if (/*subCats*/ ctx[15].subcategories != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*links*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_3$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(55:40) {#each col as subCats}",
    		ctx
    	});

    	return block;
    }

    // (52:28) {#each link.columns as col}
    function create_each_block_1(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*col*/ ctx[12].length && create_if_block_2$1(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (/*col*/ ctx[12].length) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*links*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_2$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(52:28) {#each link.columns as col}",
    		ctx
    	});

    	return block;
    }

    // (31:16) <ListItem class="level-1 custom-content-dropdown" style={link.style} horizontal>
    function create_default_slot$2(ctx) {
    	let a;
    	let span;
    	let t0_value = /*link*/ ctx[9].name + "";
    	let t0;
    	let a_class_value;
    	let a_href_value;
    	let a_data_cgid_value;
    	let each_value = /*each_value*/ ctx[10];
    	let link_index = /*link_index*/ ctx[11];
    	let t1;
    	let t2;
    	let current;
    	let mounted;
    	let dispose;
    	const assign_a = () => /*a_binding*/ ctx[3](a, each_value, link_index);
    	const unassign_a = () => /*a_binding*/ ctx[3](null, each_value, link_index);
    	let if_block = /*link*/ ctx[9].columns != undefined && create_if_block_1$2(ctx);

    	const block = {
    		c: function create() {
    			a = element("a");
    			span = element("span");
    			t0 = text(t0_value);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				class: true,
    				href: true,
    				"data-level": true,
    				"data-cgid": true,
    				target: true
    			});

    			var a_nodes = children(a);
    			span = claim_element(a_nodes, "SPAN", {});
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, t0_value);
    			span_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			t2 = claim_space(nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(span, file$6, 41, 24, 1841);
    			attr_dev(a, "class", a_class_value = "has-sub-menu show-menu-item category-" + /*link*/ ctx[9].pathId + " custom-content-dropdown" + " svelte-3ez6rp");
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[9].path);
    			attr_dev(a, "data-level", "1");
    			attr_dev(a, "data-cgid", a_data_cgid_value = /*link*/ ctx[9].pathId);
    			attr_dev(a, "target", "_self");
    			add_location(a, file$6, 31, 20, 1320);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, span);
    			append_hydration_dev(span, t0);
    			assign_a();
    			insert_hydration_dev(target, t1, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, t2, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(
    						a,
    						"mouseenter",
    						function () {
    							if (is_function(/*showCategories*/ ctx[2](/*link*/ ctx[9]))) /*showCategories*/ ctx[2](/*link*/ ctx[9]).apply(this, arguments);
    						},
    						false,
    						false,
    						false
    					),
    					listen_dev(a, "mouseleave", /*mouseleave_handler*/ ctx[4], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*links*/ 1) && t0_value !== (t0_value = /*link*/ ctx[9].name + "")) set_data_dev(t0, t0_value);

    			if (!current || dirty & /*links*/ 1 && a_class_value !== (a_class_value = "has-sub-menu show-menu-item category-" + /*link*/ ctx[9].pathId + " custom-content-dropdown" + " svelte-3ez6rp")) {
    				attr_dev(a, "class", a_class_value);
    			}

    			if (!current || dirty & /*links*/ 1 && a_href_value !== (a_href_value = /*link*/ ctx[9].path)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (!current || dirty & /*links*/ 1 && a_data_cgid_value !== (a_data_cgid_value = /*link*/ ctx[9].pathId)) {
    				attr_dev(a, "data-cgid", a_data_cgid_value);
    			}

    			if (each_value !== /*each_value*/ ctx[10] || link_index !== /*link_index*/ ctx[11]) {
    				unassign_a();
    				each_value = /*each_value*/ ctx[10];
    				link_index = /*link_index*/ ctx[11];
    				assign_a();
    			}

    			if (/*link*/ ctx[9].columns != undefined) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*links*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block_1$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t2.parentNode, t2);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			unassign_a();
    			if (detaching) detach_dev(t1);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t2);
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$2.name,
    		type: "slot",
    		source: "(31:16) <ListItem class=\\\"level-1 custom-content-dropdown\\\" style={link.style} horizontal>",
    		ctx
    	});

    	return block;
    }

    // (30:12) {#each links as link}
    function create_each_block$2(ctx) {
    	let listitem;
    	let current;

    	listitem = new ListItem({
    			props: {
    				class: "level-1 custom-content-dropdown",
    				style: /*link*/ ctx[9].style,
    				horizontal: true,
    				$$slots: { default: [create_default_slot$2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(listitem.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(listitem.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(listitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const listitem_changes = {};
    			if (dirty & /*links*/ 1) listitem_changes.style = /*link*/ ctx[9].style;

    			if (dirty & /*$$scope, links*/ 2097153) {
    				listitem_changes.$$scope = { dirty, ctx };
    			}

    			listitem.$set(listitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(listitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(listitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(listitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(30:12) {#each links as link}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let nav_1;
    	let current;
    	let if_block = /*links*/ ctx[0].length && create_if_block$3(ctx);

    	const block = {
    		c: function create() {
    			nav_1 = element("nav");
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			nav_1 = claim_element(nodes, "NAV", { id: true, role: true, class: true });
    			var nav_1_nodes = children(nav_1);
    			if (if_block) if_block.l(nav_1_nodes);
    			nav_1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(nav_1, "id", "navigation");
    			attr_dev(nav_1, "role", "navigation");
    			attr_dev(nav_1, "class", "svelte-3ez6rp");
    			add_location(nav_1, file$6, 26, 0, 1050);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, nav_1, anchor);
    			if (if_block) if_block.m(nav_1, null);
    			/*nav_1_binding*/ ctx[8](nav_1);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*links*/ ctx[0].length) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*links*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$3(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(nav_1, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(nav_1);
    			if (if_block) if_block.d();
    			/*nav_1_binding*/ ctx[8](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Meganav', slots, []);
    	let { links = [] } = $$props;
    	let nav;

    	function showCategories(link) {
    		let leftPosition = link.menuCategoryTag?.offsetLeft - 28; // Show the menu slightly to the left of the link

    		// If the menu is located beyond the window, adjust its left position
    		if (document.body.clientWidth - link.menuCategoryTag.offsetLeft < link.catagoriesContainerTag.offsetWidth) leftPosition = document.body.clientWidth - link.catagoriesContainerTag.offsetWidth - 2; // Substract 2 so it does not show right on the right border

    		link.catagoriesContainerTag.style.left = leftPosition + 'px';
    		link.catagoriesContainerTag.style.top = link.menuCategoryTag.offsetTop + nav.offsetHeight - 1 + 'px'; // Show the menu below the link
    		showOverlay.set(true);
    	}

    	onMount(() => {
    		showOverlay.set(false);
    	});

    	const writable_props = ['links'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Meganav> was created with unknown prop '${key}'`);
    	});

    	function a_binding($$value, each_value, link_index) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			each_value[link_index].menuCategoryTag = $$value;
    			$$invalidate(0, links);
    		});
    	}

    	const mouseleave_handler = () => showOverlay.set(false);

    	function div_binding($$value, each_value, link_index) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			each_value[link_index].catagoriesContainerTag = $$value;
    			$$invalidate(0, links);
    		});
    	}

    	const mouseenter_handler = () => showOverlay.set(true);
    	const mouseleave_handler_1 = () => showOverlay.set(false);

    	function nav_1_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			nav = $$value;
    			$$invalidate(1, nav);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    	};

    	$$self.$capture_state = () => ({
    		ListItem,
    		showOverlay,
    		onMount,
    		links,
    		nav,
    		showCategories
    	});

    	$$self.$inject_state = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    		if ('nav' in $$props) $$invalidate(1, nav = $$props.nav);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		links,
    		nav,
    		showCategories,
    		a_binding,
    		mouseleave_handler,
    		div_binding,
    		mouseenter_handler,
    		mouseleave_handler_1,
    		nav_1_binding
    	];
    }

    class Meganav extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$7, create_fragment$7, not_equal, { links: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Meganav",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get links() {
    		throw new Error("<Meganav>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set links(value) {
    		throw new Error("<Meganav>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Minicart\Minicart.svelte generated by Svelte v3.44.1 */
    const file$5 = "src\\Minicart\\Minicart.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    // (41:4) {#if showMinicart}
    function create_if_block$2(ctx) {
    	let div6;
    	let div0;
    	let t0;
    	let div5;
    	let div2;
    	let span0;
    	let t1_value = /*$t*/ ctx[4]('mini-cart.cart') + "";
    	let t1;
    	let t2;
    	let t3_value = /*list*/ ctx[1].length + "";
    	let t3;
    	let t4;
    	let t5;
    	let div1;
    	let span1;
    	let t6_value = /*$t*/ ctx[4]('mini-cart.subtotal') + "";
    	let t6;
    	let t7;
    	let span2;
    	let t8;
    	let t9;
    	let t10;
    	let div3;
    	let t11;
    	let div4;
    	let contentasset;
    	let t12;
    	let a;
    	let t13_value = /*$t*/ ctx[4]('mini-cart.view-cart') + "";
    	let t13;
    	let t14;
    	let i;
    	let div6_transition;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*list*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	contentasset = new ContentAsset({
    			props: { contentHTML: /*htmlContent*/ ctx[2] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div6 = element("div");
    			div0 = element("div");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t0 = space();
    			div5 = element("div");
    			div2 = element("div");
    			span0 = element("span");
    			t1 = text(t1_value);
    			t2 = text(" (");
    			t3 = text(t3_value);
    			t4 = text(")");
    			t5 = space();
    			div1 = element("div");
    			span1 = element("span");
    			t6 = text(t6_value);
    			t7 = space();
    			span2 = element("span");
    			t8 = text("$");
    			t9 = text(/*subtotal*/ ctx[0]);
    			t10 = space();
    			div3 = element("div");
    			t11 = space();
    			div4 = element("div");
    			create_component(contentasset.$$.fragment);
    			t12 = space();
    			a = element("a");
    			t13 = text(t13_value);
    			t14 = space();
    			i = element("i");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div6 = claim_element(nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			div0 = claim_element(div6_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(div0_nodes);
    			}

    			div0_nodes.forEach(detach_dev);
    			t0 = claim_space(div6_nodes);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div2 = claim_element(div5_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			span0 = claim_element(div2_nodes, "SPAN", { class: true });
    			var span0_nodes = children(span0);
    			t1 = claim_text(span0_nodes, t1_value);
    			t2 = claim_text(span0_nodes, " (");
    			t3 = claim_text(span0_nodes, t3_value);
    			t4 = claim_text(span0_nodes, ")");
    			span0_nodes.forEach(detach_dev);
    			t5 = claim_space(div2_nodes);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			span1 = claim_element(div1_nodes, "SPAN", { class: true });
    			var span1_nodes = children(span1);
    			t6 = claim_text(span1_nodes, t6_value);
    			span1_nodes.forEach(detach_dev);
    			t7 = claim_space(div1_nodes);
    			span2 = claim_element(div1_nodes, "SPAN", { class: true });
    			var span2_nodes = children(span2);
    			t8 = claim_text(span2_nodes, "$");
    			t9 = claim_text(span2_nodes, /*subtotal*/ ctx[0]);
    			span2_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t10 = claim_space(div5_nodes);
    			div3 = claim_element(div5_nodes, "DIV", { class: true });
    			children(div3).forEach(detach_dev);
    			t11 = claim_space(div5_nodes);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			claim_component(contentasset.$$.fragment, div4_nodes);
    			div4_nodes.forEach(detach_dev);
    			t12 = claim_space(div5_nodes);
    			a = claim_element(div5_nodes, "A", { class: true, href: true, title: true });
    			var a_nodes = children(a);
    			t13 = claim_text(a_nodes, t13_value);
    			a_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t14 = claim_space(div6_nodes);
    			i = claim_element(div6_nodes, "I", { class: true });
    			children(i).forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "mini-cart-products svelte-b1j342");
    			add_location(div0, file$5, 47, 12, 1504);
    			attr_dev(span0, "class", "label svelte-b1j342");
    			add_location(span0, file$5, 98, 20, 4253);
    			attr_dev(span1, "class", "label svelte-b1j342");
    			add_location(span1, file$5, 100, 24, 4405);
    			attr_dev(span2, "class", "value svelte-b1j342");
    			add_location(span2, file$5, 101, 24, 4484);
    			attr_dev(div1, "class", "mini-cart-subtotals-price svelte-b1j342");
    			add_location(div1, file$5, 99, 20, 4340);
    			attr_dev(div2, "class", "mini-cart-subtotals svelte-b1j342");
    			add_location(div2, file$5, 97, 16, 4198);
    			attr_dev(div3, "class", "mini-cart-promo svelte-b1j342");
    			add_location(div3, file$5, 104, 16, 4592);
    			attr_dev(div4, "class", "mini-cart-slot");
    			add_location(div4, file$5, 105, 16, 4641);
    			attr_dev(a, "class", "button mini-cart-link-cart svelte-b1j342");
    			attr_dev(a, "href", "https://www.ashleyfurniture.com/cart/");
    			attr_dev(a, "title", "Go to Cart");
    			add_location(a, file$5, 108, 16, 4775);
    			attr_dev(div5, "class", "mini-cart-totals svelte-b1j342");
    			add_location(div5, file$5, 96, 12, 4150);
    			attr_dev(i, "class", "svelte-b1j342");
    			add_location(i, file$5, 112, 12, 4982);
    			attr_dev(div6, "class", "mini-cart-content svelte-b1j342");
    			add_location(div6, file$5, 41, 8, 1259);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div6, anchor);
    			append_hydration_dev(div6, div0);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(div0, null);
    			}

    			append_hydration_dev(div6, t0);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, div2);
    			append_hydration_dev(div2, span0);
    			append_hydration_dev(span0, t1);
    			append_hydration_dev(span0, t2);
    			append_hydration_dev(span0, t3);
    			append_hydration_dev(span0, t4);
    			append_hydration_dev(div2, t5);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, span1);
    			append_hydration_dev(span1, t6);
    			append_hydration_dev(div1, t7);
    			append_hydration_dev(div1, span2);
    			append_hydration_dev(span2, t8);
    			append_hydration_dev(span2, t9);
    			append_hydration_dev(div5, t10);
    			append_hydration_dev(div5, div3);
    			append_hydration_dev(div5, t11);
    			append_hydration_dev(div5, div4);
    			mount_component(contentasset, div4, null);
    			append_hydration_dev(div5, t12);
    			append_hydration_dev(div5, a);
    			append_hydration_dev(a, t13);
    			append_hydration_dev(div6, t14);
    			append_hydration_dev(div6, i);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div6, "mouseenter", /*showCart*/ ctx[5], false, false, false),
    					listen_dev(div6, "mouseleave", /*mouseleave_handler*/ ctx[6], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;

    			if (dirty & /*$t, list*/ 18) {
    				each_value = /*list*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(div0, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if ((!current || dirty & /*$t*/ 16) && t1_value !== (t1_value = /*$t*/ ctx[4]('mini-cart.cart') + "")) set_data_dev(t1, t1_value);
    			if ((!current || dirty & /*list*/ 2) && t3_value !== (t3_value = /*list*/ ctx[1].length + "")) set_data_dev(t3, t3_value);
    			if ((!current || dirty & /*$t*/ 16) && t6_value !== (t6_value = /*$t*/ ctx[4]('mini-cart.subtotal') + "")) set_data_dev(t6, t6_value);
    			if (!current || dirty & /*subtotal*/ 1) set_data_dev(t9, /*subtotal*/ ctx[0]);
    			const contentasset_changes = {};
    			if (dirty & /*htmlContent*/ 4) contentasset_changes.contentHTML = /*htmlContent*/ ctx[2];
    			contentasset.$set(contentasset_changes);
    			if ((!current || dirty & /*$t*/ 16) && t13_value !== (t13_value = /*$t*/ ctx[4]('mini-cart.view-cart') + "")) set_data_dev(t13, t13_value);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(contentasset.$$.fragment, local);

    			add_render_callback(() => {
    				if (!div6_transition) div6_transition = create_bidirectional_transition(
    					div6,
    					slide,
    					{
    						delay: 800,
    						duration: 1100,
    						easing: quintOut
    					},
    					true
    				);

    				div6_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(contentasset.$$.fragment, local);

    			if (!div6_transition) div6_transition = create_bidirectional_transition(
    				div6,
    				slide,
    				{
    					delay: 800,
    					duration: 1100,
    					easing: quintOut
    				},
    				false
    			);

    			div6_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div6);
    			destroy_each(each_blocks, detaching);
    			destroy_component(contentasset);
    			if (detaching && div6_transition) div6_transition.end();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$2.name,
    		type: "if",
    		source: "(41:4) {#if showMinicart}",
    		ctx
    	});

    	return block;
    }

    // (57:32) {#if item.setAmount}
    function create_if_block_1$1(ctx) {
    	let span;
    	let t0;
    	let t1_value = /*$t*/ ctx[4]('mini-cart.set') + "";
    	let t1;
    	let t2_value = /*item*/ ctx[9].setAmount + "";
    	let t2;
    	let t3;

    	const block = {
    		c: function create() {
    			span = element("span");
    			t0 = text("(");
    			t1 = text(t1_value);
    			t2 = text(t2_value);
    			t3 = text(")");
    			this.h();
    		},
    		l: function claim(nodes) {
    			span = claim_element(nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t0 = claim_text(span_nodes, "(");
    			t1 = claim_text(span_nodes, t1_value);
    			t2 = claim_text(span_nodes, t2_value);
    			t3 = claim_text(span_nodes, ")");
    			span_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "name-set svelte-b1j342");
    			add_location(span, file$5, 57, 36, 2059);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, span, anchor);
    			append_hydration_dev(span, t0);
    			append_hydration_dev(span, t1);
    			append_hydration_dev(span, t2);
    			append_hydration_dev(span, t3);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*$t*/ 16 && t1_value !== (t1_value = /*$t*/ ctx[4]('mini-cart.set') + "")) set_data_dev(t1, t1_value);
    			if (dirty & /*list*/ 2 && t2_value !== (t2_value = /*item*/ ctx[9].setAmount + "")) set_data_dev(t2, t2_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(span);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1$1.name,
    		type: "if",
    		source: "(57:32) {#if item.setAmount}",
    		ctx
    	});

    	return block;
    }

    // (49:16) {#each list as item}
    function create_each_block$1(ctx) {
    	let div7;
    	let div0;
    	let img;
    	let img_src_value;
    	let img_alt_value;
    	let t0;
    	let div1;
    	let a0;
    	let t1_value = /*item*/ ctx[9].name + "";
    	let t1;
    	let t2;
    	let a0_href_value;
    	let a0_title_value;
    	let t3;
    	let div4;
    	let div2;
    	let t4_value = /*$t*/ ctx[4]('mini-cart.item') + "";
    	let t4;
    	let t5_value = /*item*/ ctx[9].sku + "";
    	let t5;
    	let t6;
    	let div3;
    	let span0;
    	let t7_value = /*$t*/ ctx[4]('mini-cart.color') + "";
    	let t7;
    	let t8;
    	let span1;
    	let t9_value = /*item*/ ctx[9].color + "";
    	let t9;
    	let div3_data_attribute_value;
    	let t10;
    	let div5;
    	let span2;
    	let t11_value = /*$t*/ ctx[4]('mini-cart.qty') + "";
    	let t11;
    	let t12;
    	let span3;
    	let t13_value = /*item*/ ctx[9].qty + "";
    	let t13;
    	let t14;
    	let span4;
    	let t15;
    	let t16_value = /*item*/ ctx[9].price + "";
    	let t16;
    	let t17;
    	let div6;
    	let span5;
    	let a1;
    	let t18_value = /*$t*/ ctx[4]('mini-cart.remove') + "";
    	let t18;
    	let t19;
    	let span6;
    	let a2;
    	let t20_value = /*$t*/ ctx[4]('mini-cart.save') + "";
    	let t20;
    	let t21;
    	let if_block = /*item*/ ctx[9].setAmount && create_if_block_1$1(ctx);

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div0 = element("div");
    			img = element("img");
    			t0 = space();
    			div1 = element("div");
    			a0 = element("a");
    			t1 = text(t1_value);
    			t2 = space();
    			if (if_block) if_block.c();
    			t3 = space();
    			div4 = element("div");
    			div2 = element("div");
    			t4 = text(t4_value);
    			t5 = text(t5_value);
    			t6 = space();
    			div3 = element("div");
    			span0 = element("span");
    			t7 = text(t7_value);
    			t8 = space();
    			span1 = element("span");
    			t9 = text(t9_value);
    			t10 = space();
    			div5 = element("div");
    			span2 = element("span");
    			t11 = text(t11_value);
    			t12 = space();
    			span3 = element("span");
    			t13 = text(t13_value);
    			t14 = space();
    			span4 = element("span");
    			t15 = text("$");
    			t16 = text(t16_value);
    			t17 = space();
    			div6 = element("div");
    			span5 = element("span");
    			a1 = element("a");
    			t18 = text(t18_value);
    			t19 = text("\r\n                            |\r\n                            ");
    			span6 = element("span");
    			a2 = element("a");
    			t20 = text(t20_value);
    			t21 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div7 = claim_element(nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			div0 = claim_element(div7_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			img = claim_element(div0_nodes, "IMG", { src: true, alt: true, class: true });
    			div0_nodes.forEach(detach_dev);
    			t0 = claim_space(div7_nodes);
    			div1 = claim_element(div7_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			a0 = claim_element(div1_nodes, "A", { href: true, title: true, class: true });
    			var a0_nodes = children(a0);
    			t1 = claim_text(a0_nodes, t1_value);
    			t2 = claim_space(a0_nodes);
    			if (if_block) if_block.l(a0_nodes);
    			a0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			t3 = claim_space(div7_nodes);
    			div4 = claim_element(div7_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			div2 = claim_element(div4_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			t4 = claim_text(div2_nodes, t4_value);
    			t5 = claim_text(div2_nodes, t5_value);
    			div2_nodes.forEach(detach_dev);
    			t6 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true, "data-attribute": true });
    			var div3_nodes = children(div3);
    			span0 = claim_element(div3_nodes, "SPAN", { class: true });
    			var span0_nodes = children(span0);
    			t7 = claim_text(span0_nodes, t7_value);
    			span0_nodes.forEach(detach_dev);
    			t8 = claim_space(div3_nodes);
    			span1 = claim_element(div3_nodes, "SPAN", { class: true });
    			var span1_nodes = children(span1);
    			t9 = claim_text(span1_nodes, t9_value);
    			span1_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t10 = claim_space(div7_nodes);
    			div5 = claim_element(div7_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			span2 = claim_element(div5_nodes, "SPAN", { class: true });
    			var span2_nodes = children(span2);
    			t11 = claim_text(span2_nodes, t11_value);
    			span2_nodes.forEach(detach_dev);
    			t12 = claim_space(div5_nodes);
    			span3 = claim_element(div5_nodes, "SPAN", { class: true });
    			var span3_nodes = children(span3);
    			t13 = claim_text(span3_nodes, t13_value);
    			span3_nodes.forEach(detach_dev);
    			t14 = claim_space(div5_nodes);
    			span4 = claim_element(div5_nodes, "SPAN", { class: true });
    			var span4_nodes = children(span4);
    			t15 = claim_text(span4_nodes, "$");
    			t16 = claim_text(span4_nodes, t16_value);
    			span4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t17 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true });
    			var div6_nodes = children(div6);
    			span5 = claim_element(div6_nodes, "SPAN", { class: true });
    			var span5_nodes = children(span5);
    			a1 = claim_element(span5_nodes, "A", { class: true, href: true });
    			var a1_nodes = children(a1);
    			t18 = claim_text(a1_nodes, t18_value);
    			a1_nodes.forEach(detach_dev);
    			span5_nodes.forEach(detach_dev);
    			t19 = claim_text(div6_nodes, "\r\n                            |\r\n                            ");
    			span6 = claim_element(div6_nodes, "SPAN", { class: true });
    			var span6_nodes = children(span6);

    			a2 = claim_element(span6_nodes, "A", {
    				class: true,
    				"data-auth": true,
    				href: true
    			});

    			var a2_nodes = children(a2);
    			t20 = claim_text(a2_nodes, t20_value);
    			a2_nodes.forEach(detach_dev);
    			span6_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			t21 = claim_space(div7_nodes);
    			div7_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img.src, img_src_value = /*item*/ ctx[9].imgUrl)) attr_dev(img, "src", img_src_value);
    			attr_dev(img, "alt", img_alt_value = /*item*/ ctx[9].alt);
    			attr_dev(img, "class", "svelte-b1j342");
    			add_location(img, file$5, 51, 28, 1712);
    			attr_dev(div0, "class", "mini-cart-image svelte-b1j342");
    			add_location(div0, file$5, 50, 24, 1653);
    			attr_dev(a0, "href", a0_href_value = /*item*/ ctx[9].url);
    			attr_dev(a0, "title", a0_title_value = "Go to Product: " + /*item*/ ctx[9].name);
    			attr_dev(a0, "class", "svelte-b1j342");
    			add_location(a0, file$5, 54, 28, 1868);
    			attr_dev(div1, "class", "mini-cart-name svelte-b1j342");
    			add_location(div1, file$5, 53, 24, 1810);
    			attr_dev(div2, "class", "attribute-skuid");
    			add_location(div2, file$5, 62, 28, 2324);
    			attr_dev(span0, "class", "label");
    			add_location(span0, file$5, 64, 32, 2503);
    			attr_dev(span1, "class", "value");
    			add_location(span1, file$5, 65, 32, 2587);
    			attr_dev(div3, "class", "attribute svelte-b1j342");
    			attr_dev(div3, "data-attribute", div3_data_attribute_value = /*item*/ ctx[9].dt);
    			add_location(div3, file$5, 63, 28, 2421);
    			attr_dev(div4, "class", "mini-cart-attributes svelte-b1j342");
    			add_location(div4, file$5, 61, 24, 2260);
    			attr_dev(span2, "class", "label");
    			add_location(span2, file$5, 69, 28, 2781);
    			attr_dev(span3, "class", "value");
    			add_location(span3, file$5, 70, 28, 2859);
    			attr_dev(span4, "class", "mini-cart-price svelte-b1j342");
    			add_location(span4, file$5, 71, 28, 2926);
    			attr_dev(div5, "class", "mini-cart-pricing svelte-b1j342");
    			add_location(div5, file$5, 68, 24, 2720);
    			attr_dev(a1, "class", "remove-cart-item svelte-b1j342");
    			attr_dev(a1, "href", "/Cart-RemoveProduct?pid=R600021632&uuid=c2e5b465a44733d22d7f0d3d0e");
    			add_location(a1, file$5, 75, 32, 3155);
    			attr_dev(span5, "class", "label svelte-b1j342");
    			add_location(span5, file$5, 74, 28, 3101);
    			attr_dev(a2, "class", "save-item svelte-b1j342");
    			attr_dev(a2, "data-auth", "false");
    			attr_dev(a2, "href", "/Wishlist-Add?pid=R600021632&uuid=c2e5b465a44733d22d7f0d3d0e&Quantity=1%2e0");
    			add_location(a2, file$5, 84, 32, 3621);
    			attr_dev(span6, "class", "label svelte-b1j342");
    			add_location(span6, file$5, 83, 28, 3567);
    			attr_dev(div6, "class", "minicart-product-option svelte-b1j342");
    			add_location(div6, file$5, 73, 24, 3034);
    			attr_dev(div7, "class", "mini-cart-product svelte-b1j342");
    			add_location(div7, file$5, 49, 20, 1596);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div7, anchor);
    			append_hydration_dev(div7, div0);
    			append_hydration_dev(div0, img);
    			append_hydration_dev(div7, t0);
    			append_hydration_dev(div7, div1);
    			append_hydration_dev(div1, a0);
    			append_hydration_dev(a0, t1);
    			append_hydration_dev(a0, t2);
    			if (if_block) if_block.m(a0, null);
    			append_hydration_dev(div7, t3);
    			append_hydration_dev(div7, div4);
    			append_hydration_dev(div4, div2);
    			append_hydration_dev(div2, t4);
    			append_hydration_dev(div2, t5);
    			append_hydration_dev(div4, t6);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, span0);
    			append_hydration_dev(span0, t7);
    			append_hydration_dev(div3, t8);
    			append_hydration_dev(div3, span1);
    			append_hydration_dev(span1, t9);
    			append_hydration_dev(div7, t10);
    			append_hydration_dev(div7, div5);
    			append_hydration_dev(div5, span2);
    			append_hydration_dev(span2, t11);
    			append_hydration_dev(div5, t12);
    			append_hydration_dev(div5, span3);
    			append_hydration_dev(span3, t13);
    			append_hydration_dev(div5, t14);
    			append_hydration_dev(div5, span4);
    			append_hydration_dev(span4, t15);
    			append_hydration_dev(span4, t16);
    			append_hydration_dev(div7, t17);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, span5);
    			append_hydration_dev(span5, a1);
    			append_hydration_dev(a1, t18);
    			append_hydration_dev(div6, t19);
    			append_hydration_dev(div6, span6);
    			append_hydration_dev(span6, a2);
    			append_hydration_dev(a2, t20);
    			append_hydration_dev(div7, t21);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*list*/ 2 && !src_url_equal(img.src, img_src_value = /*item*/ ctx[9].imgUrl)) {
    				attr_dev(img, "src", img_src_value);
    			}

    			if (dirty & /*list*/ 2 && img_alt_value !== (img_alt_value = /*item*/ ctx[9].alt)) {
    				attr_dev(img, "alt", img_alt_value);
    			}

    			if (dirty & /*list*/ 2 && t1_value !== (t1_value = /*item*/ ctx[9].name + "")) set_data_dev(t1, t1_value);

    			if (/*item*/ ctx[9].setAmount) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block_1$1(ctx);
    					if_block.c();
    					if_block.m(a0, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}

    			if (dirty & /*list*/ 2 && a0_href_value !== (a0_href_value = /*item*/ ctx[9].url)) {
    				attr_dev(a0, "href", a0_href_value);
    			}

    			if (dirty & /*list*/ 2 && a0_title_value !== (a0_title_value = "Go to Product: " + /*item*/ ctx[9].name)) {
    				attr_dev(a0, "title", a0_title_value);
    			}

    			if (dirty & /*$t*/ 16 && t4_value !== (t4_value = /*$t*/ ctx[4]('mini-cart.item') + "")) set_data_dev(t4, t4_value);
    			if (dirty & /*list*/ 2 && t5_value !== (t5_value = /*item*/ ctx[9].sku + "")) set_data_dev(t5, t5_value);
    			if (dirty & /*$t*/ 16 && t7_value !== (t7_value = /*$t*/ ctx[4]('mini-cart.color') + "")) set_data_dev(t7, t7_value);
    			if (dirty & /*list*/ 2 && t9_value !== (t9_value = /*item*/ ctx[9].color + "")) set_data_dev(t9, t9_value);

    			if (dirty & /*list*/ 2 && div3_data_attribute_value !== (div3_data_attribute_value = /*item*/ ctx[9].dt)) {
    				attr_dev(div3, "data-attribute", div3_data_attribute_value);
    			}

    			if (dirty & /*$t*/ 16 && t11_value !== (t11_value = /*$t*/ ctx[4]('mini-cart.qty') + "")) set_data_dev(t11, t11_value);
    			if (dirty & /*list*/ 2 && t13_value !== (t13_value = /*item*/ ctx[9].qty + "")) set_data_dev(t13, t13_value);
    			if (dirty & /*list*/ 2 && t16_value !== (t16_value = /*item*/ ctx[9].price + "")) set_data_dev(t16, t16_value);
    			if (dirty & /*$t*/ 16 && t18_value !== (t18_value = /*$t*/ ctx[4]('mini-cart.remove') + "")) set_data_dev(t18, t18_value);
    			if (dirty & /*$t*/ 16 && t20_value !== (t20_value = /*$t*/ ctx[4]('mini-cart.save') + "")) set_data_dev(t20, t20_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    			if (if_block) if_block.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(49:16) {#each list as item}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div1;
    	let div0;
    	let a;
    	let shoppingcarticon;
    	let t0;
    	let cartquantityshadow;
    	let t1;
    	let span;
    	let t2_value = /*list*/ ctx[1].length + "";
    	let t2;
    	let t3;
    	let current;
    	let mounted;
    	let dispose;
    	shoppingcarticon = new Shopping_cart_icon({ $$inline: true });
    	cartquantityshadow = new Cart_quantity_shadow({ $$inline: true });
    	let if_block = /*showMinicart*/ ctx[3] && create_if_block$2(ctx);

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			a = element("a");
    			create_component(shoppingcarticon.$$.fragment);
    			t0 = space();
    			create_component(cartquantityshadow.$$.fragment);
    			t1 = space();
    			span = element("span");
    			t2 = text(t2_value);
    			t3 = space();
    			if (if_block) if_block.c();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { id: true, class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);

    			a = claim_element(div0_nodes, "A", {
    				class: true,
    				href: true,
    				title: true,
    				"aria-expanded": true
    			});

    			var a_nodes = children(a);
    			claim_component(shoppingcarticon.$$.fragment, a_nodes);
    			t0 = claim_space(a_nodes);
    			claim_component(cartquantityshadow.$$.fragment, a_nodes);
    			t1 = claim_space(a_nodes);
    			span = claim_element(a_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t2 = claim_text(span_nodes, t2_value);
    			span_nodes.forEach(detach_dev);
    			a_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t3 = claim_space(div1_nodes);
    			if (if_block) if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "minicart-quantity svelte-b1j342");
    			add_location(span, file$5, 36, 12, 1145);
    			attr_dev(a, "class", "mini-cart-link svelte-b1j342");
    			attr_dev(a, "href", "https://www.ashleyfurniture.com/cart/");
    			attr_dev(a, "title", "View Shopping Cart");
    			attr_dev(a, "aria-expanded", "false");
    			add_location(a, file$5, 28, 8, 879);
    			attr_dev(div0, "class", "mini-cart-total svelte-b1j342");
    			add_location(div0, file$5, 27, 4, 840);
    			attr_dev(div1, "id", "mini-cart");
    			attr_dev(div1, "class", "svelte-b1j342");
    			add_location(div1, file$5, 26, 0, 744);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a);
    			mount_component(shoppingcarticon, a, null);
    			append_hydration_dev(a, t0);
    			mount_component(cartquantityshadow, a, null);
    			append_hydration_dev(a, t1);
    			append_hydration_dev(a, span);
    			append_hydration_dev(span, t2);
    			append_hydration_dev(div1, t3);
    			if (if_block) if_block.m(div1, null);
    			current = true;

    			if (!mounted) {
    				dispose = [
    					listen_dev(div1, "mouseenter", /*showCart*/ ctx[5], false, false, false),
    					listen_dev(div1, "mouseleave", /*mouseleave_handler_1*/ ctx[7], false, false, false)
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if ((!current || dirty & /*list*/ 2) && t2_value !== (t2_value = /*list*/ ctx[1].length + "")) set_data_dev(t2, t2_value);

    			if (/*showMinicart*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*showMinicart*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$2(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div1, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(shoppingcarticon.$$.fragment, local);
    			transition_in(cartquantityshadow.$$.fragment, local);
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(shoppingcarticon.$$.fragment, local);
    			transition_out(cartquantityshadow.$$.fragment, local);
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(shoppingcarticon);
    			destroy_component(cartquantityshadow);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $t;
    	validate_store($format, 't');
    	component_subscribe($$self, $format, $$value => $$invalidate(4, $t = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Minicart', slots, []);
    	let { list = [], subtotal = 0, htmlContent = '' } = $$props;
    	let showMinicart = false;

    	function showCart() {
    		if (list.length != 0) $$invalidate(3, showMinicart = true);
    	}

    	function calculateSum() {
    		$$invalidate(0, subtotal = list.reduce((accumulator, currentValue) => accumulator + currentValue.price, 0));
    	}

    	onMount(() => {
    		calculateSum();
    	});

    	const writable_props = ['list', 'subtotal', 'htmlContent'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Minicart> was created with unknown prop '${key}'`);
    	});

    	const mouseleave_handler = () => $$invalidate(3, showMinicart = false);
    	const mouseleave_handler_1 = () => $$invalidate(3, showMinicart = false);

    	$$self.$$set = $$props => {
    		if ('list' in $$props) $$invalidate(1, list = $$props.list);
    		if ('subtotal' in $$props) $$invalidate(0, subtotal = $$props.subtotal);
    		if ('htmlContent' in $$props) $$invalidate(2, htmlContent = $$props.htmlContent);
    	};

    	$$self.$capture_state = () => ({
    		slide,
    		quintOut,
    		onMount,
    		CartQuantityShadow: Cart_quantity_shadow,
    		ShoppingCartIcon: Shopping_cart_icon,
    		ContentAsset,
    		t: $format,
    		list,
    		subtotal,
    		htmlContent,
    		showMinicart,
    		showCart,
    		calculateSum,
    		$t
    	});

    	$$self.$inject_state = $$props => {
    		if ('list' in $$props) $$invalidate(1, list = $$props.list);
    		if ('subtotal' in $$props) $$invalidate(0, subtotal = $$props.subtotal);
    		if ('htmlContent' in $$props) $$invalidate(2, htmlContent = $$props.htmlContent);
    		if ('showMinicart' in $$props) $$invalidate(3, showMinicart = $$props.showMinicart);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		subtotal,
    		list,
    		htmlContent,
    		showMinicart,
    		$t,
    		showCart,
    		mouseleave_handler,
    		mouseleave_handler_1
    	];
    }

    class Minicart extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$6, create_fragment$6, not_equal, { list: 1, subtotal: 0, htmlContent: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Minicart",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get list() {
    		throw new Error("<Minicart>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set list(value) {
    		throw new Error("<Minicart>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get subtotal() {
    		throw new Error("<Minicart>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set subtotal(value) {
    		throw new Error("<Minicart>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get htmlContent() {
    		throw new Error("<Minicart>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set htmlContent(value) {
    		throw new Error("<Minicart>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Linkmenu\Linkmenu.svelte generated by Svelte v3.44.1 */
    const file$4 = "src\\Linkmenu\\Linkmenu.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[4] = list[i];
    	child_ctx[5] = list;
    	child_ctx[6] = i;
    	return child_ctx;
    }

    // (28:12) {#if link.dropdown}
    function create_if_block$1(ctx) {
    	let div1;
    	let div0;
    	let span;
    	let closeicon;
    	let t;
    	let html_tag;
    	let raw_value = /*link*/ ctx[4].dropdown + "";
    	let div1_class_value;
    	let current;
    	let mounted;
    	let dispose;
    	closeicon = new Close_icon({ $$inline: true });

    	function click_handler_1() {
    		return /*click_handler_1*/ ctx[3](/*link*/ ctx[4], /*each_value*/ ctx[5], /*link_index*/ ctx[6]);
    	}

    	const block = {
    		c: function create() {
    			div1 = element("div");
    			div0 = element("div");
    			span = element("span");
    			create_component(closeicon.$$.fragment);
    			t = space();
    			html_tag = new HtmlTagHydration();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			span = claim_element(div0_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			claim_component(closeicon.$$.fragment, span_nodes);
    			span_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t = claim_space(div1_nodes);
    			html_tag = claim_html_tag(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "icon-closethick svelte-12zpjb4");
    			add_location(span, file$4, 30, 24, 1032);
    			attr_dev(div0, "class", "close-header-overlay svelte-12zpjb4");
    			add_location(div0, file$4, 29, 20, 972);
    			html_tag.a = null;
    			attr_dev(div1, "class", div1_class_value = "header-user-panel header-flyout " + (/*link*/ ctx[4].showDropdown === true ? 'show' : '') + " svelte-12zpjb4");
    			add_location(div1, file$4, 28, 16, 862);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, span);
    			mount_component(closeicon, span, null);
    			append_hydration_dev(div1, t);
    			html_tag.m(raw_value, div1);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(span, "click", click_handler_1, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*links*/ 1) && raw_value !== (raw_value = /*link*/ ctx[4].dropdown + "")) html_tag.p(raw_value);

    			if (!current || dirty & /*links*/ 1 && div1_class_value !== (div1_class_value = "header-user-panel header-flyout " + (/*link*/ ctx[4].showDropdown === true ? 'show' : '') + " svelte-12zpjb4")) {
    				attr_dev(div1, "class", div1_class_value);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(closeicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(closeicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div1);
    			destroy_component(closeicon);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(28:12) {#if link.dropdown}",
    		ctx
    	});

    	return block;
    }

    // (19:8) <ListItem class="util-link header-flyout-trigger">
    function create_default_slot$1(ctx) {
    	let a;
    	let raw_value = /*link*/ ctx[4].name + "";
    	let a_href_value;
    	let a_title_value;
    	let t0;
    	let t1;
    	let current;
    	let mounted;
    	let dispose;

    	function click_handler(...args) {
    		return /*click_handler*/ ctx[2](/*link*/ ctx[4], ...args);
    	}

    	let if_block = /*link*/ ctx[4].dropdown && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			a = element("a");
    			t0 = space();
    			if (if_block) if_block.c();
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, title: true, class: true });
    			var a_nodes = children(a);
    			a_nodes.forEach(detach_dev);
    			t0 = claim_space(nodes);
    			if (if_block) if_block.l(nodes);
    			t1 = claim_space(nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", a_href_value = /*link*/ ctx[4].url);
    			attr_dev(a, "title", a_title_value = /*link*/ ctx[4].title);
    			attr_dev(a, "class", "account-text-container svelte-12zpjb4");
    			add_location(a, file$4, 19, 12, 567);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			a.innerHTML = raw_value;
    			insert_hydration_dev(target, t0, anchor);
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, t1, anchor);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(a, "click", click_handler, false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			if ((!current || dirty & /*links*/ 1) && raw_value !== (raw_value = /*link*/ ctx[4].name + "")) a.innerHTML = raw_value;
    			if (!current || dirty & /*links*/ 1 && a_href_value !== (a_href_value = /*link*/ ctx[4].url)) {
    				attr_dev(a, "href", a_href_value);
    			}

    			if (!current || dirty & /*links*/ 1 && a_title_value !== (a_title_value = /*link*/ ctx[4].title)) {
    				attr_dev(a, "title", a_title_value);
    			}

    			if (/*link*/ ctx[4].dropdown) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*links*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(t1.parentNode, t1);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t0);
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(t1);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot$1.name,
    		type: "slot",
    		source: "(19:8) <ListItem class=\\\"util-link header-flyout-trigger\\\">",
    		ctx
    	});

    	return block;
    }

    // (18:4) {#each links as link}
    function create_each_block(ctx) {
    	let listitem;
    	let current;

    	listitem = new ListItem({
    			props: {
    				class: "util-link header-flyout-trigger",
    				$$slots: { default: [create_default_slot$1] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(listitem.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(listitem.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(listitem, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const listitem_changes = {};

    			if (dirty & /*$$scope, links*/ 129) {
    				listitem_changes.$$scope = { dirty, ctx };
    			}

    			listitem.$set(listitem_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(listitem.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(listitem.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(listitem, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(18:4) {#each links as link}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$5(ctx) {
    	let ul;
    	let current;
    	let each_value = /*links*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	const block = {
    		c: function create() {
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			this.h();
    		},
    		l: function claim(nodes) {
    			ul = claim_element(nodes, "UL", { class: true });
    			var ul_nodes = children(ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ul_nodes);
    			}

    			ul_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(ul, "class", "menu-utility-user svelte-12zpjb4");
    			add_location(ul, file$4, 16, 0, 436);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, ul, anchor);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*links, showOverlay, showDropdown*/ 3) {
    				each_value = /*links*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    						transition_in(each_blocks[i], 1);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						transition_in(each_blocks[i], 1);
    						each_blocks[i].m(ul, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			current = true;
    		},
    		o: function outro(local) {
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(ul);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Linkmenu', slots, []);
    	let { links = [] } = $$props;

    	function showDropdown(e, link) {
    		if (link.dropdown) {
    			e.preventDefault();
    			link.showDropdown = true;
    			$$invalidate(0, links);
    		}

    		showOverlay.set(true);
    	}

    	const writable_props = ['links'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Linkmenu> was created with unknown prop '${key}'`);
    	});

    	const click_handler = (link, e) => showDropdown(e, link);

    	const click_handler_1 = (link, each_value, link_index) => {
    		$$invalidate(0, each_value[link_index].showDropdown = false, links);
    		showOverlay.set(false);
    	};

    	$$self.$$set = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    	};

    	$$self.$capture_state = () => ({
    		ListItem,
    		CloseIcon: Close_icon,
    		showOverlay,
    		links,
    		showDropdown
    	});

    	$$self.$inject_state = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [links, showDropdown, click_handler, click_handler_1];
    }

    class Linkmenu extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$5, create_fragment$5, not_equal, { links: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Linkmenu",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get links() {
    		throw new Error("<Linkmenu>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set links(value) {
    		throw new Error("<Linkmenu>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\Scheduler\Scheduler.svelte generated by Svelte v3.44.1 */

    // (27:0) {#if todayInRange}
    function create_if_block(ctx) {
    	let current_block_type_index;
    	let if_block;
    	let if_block_anchor;
    	let current;
    	const if_block_creators = [create_if_block_1, create_if_block_2, create_if_block_3, create_else_block];
    	const if_blocks = [];

    	function select_block_type(ctx, dirty) {
    		if (/*contentHTML*/ ctx[1] != null) return 0;
    		if (/*lazyLoadComponent*/ ctx[2] != null) return 1;
    		if (/*contentComponent*/ ctx[0]) return 2;
    		return 3;
    	}

    	current_block_type_index = select_block_type(ctx);
    	if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);

    	const block = {
    		c: function create() {
    			if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if_blocks[current_block_type_index].m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			let previous_block_index = current_block_type_index;
    			current_block_type_index = select_block_type(ctx);

    			if (current_block_type_index === previous_block_index) {
    				if_blocks[current_block_type_index].p(ctx, dirty);
    			} else {
    				group_outros();

    				transition_out(if_blocks[previous_block_index], 1, 1, () => {
    					if_blocks[previous_block_index] = null;
    				});

    				check_outros();
    				if_block = if_blocks[current_block_type_index];

    				if (!if_block) {
    					if_block = if_blocks[current_block_type_index] = if_block_creators[current_block_type_index](ctx);
    					if_block.c();
    				} else {
    					if_block.p(ctx, dirty);
    				}

    				transition_in(if_block, 1);
    				if_block.m(if_block_anchor.parentNode, if_block_anchor);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if_blocks[current_block_type_index].d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(27:0) {#if todayInRange}",
    		ctx
    	});

    	return block;
    }

    // (40:4) {:else}
    function create_else_block(ctx) {
    	let contentasset;
    	let current;
    	contentasset = new ContentAsset({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(contentasset.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(contentasset.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(contentasset, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(contentasset.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(contentasset.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(contentasset, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_else_block.name,
    		type: "else",
    		source: "(40:4) {:else}",
    		ctx
    	});

    	return block;
    }

    // (38:31) 
    function create_if_block_3(ctx) {
    	let contentasset;
    	let current;

    	contentasset = new ContentAsset({
    			props: {
    				contentComponent: /*contentComponent*/ ctx[0]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(contentasset.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(contentasset.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(contentasset, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const contentasset_changes = {};
    			if (dirty & /*contentComponent*/ 1) contentasset_changes.contentComponent = /*contentComponent*/ ctx[0];
    			contentasset.$set(contentasset_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(contentasset.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(contentasset.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(contentasset, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_3.name,
    		type: "if",
    		source: "(38:31) ",
    		ctx
    	});

    	return block;
    }

    // (30:40) 
    function create_if_block_2(ctx) {
    	let await_block_anchor;
    	let promise;
    	let current;

    	let info = {
    		ctx,
    		current: null,
    		token: null,
    		hasCatch: true,
    		pending: create_pending_block,
    		then: create_then_block,
    		catch: create_catch_block,
    		value: 7,
    		error: 8,
    		blocks: [,,,]
    	};

    	handle_promise(promise = /*lazyLoadComponent*/ ctx[2], info);

    	const block = {
    		c: function create() {
    			await_block_anchor = empty();
    			info.block.c();
    		},
    		l: function claim(nodes) {
    			await_block_anchor = empty();
    			info.block.l(nodes);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, await_block_anchor, anchor);
    			info.block.m(target, info.anchor = anchor);
    			info.mount = () => await_block_anchor.parentNode;
    			info.anchor = await_block_anchor;
    			current = true;
    		},
    		p: function update(new_ctx, dirty) {
    			ctx = new_ctx;
    			info.ctx = ctx;

    			if (dirty & /*lazyLoadComponent*/ 4 && promise !== (promise = /*lazyLoadComponent*/ ctx[2]) && handle_promise(promise, info)) ; else {
    				update_await_block_branch(info, ctx, dirty);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(info.block);
    			current = true;
    		},
    		o: function outro(local) {
    			for (let i = 0; i < 3; i += 1) {
    				const block = info.blocks[i];
    				transition_out(block);
    			}

    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(await_block_anchor);
    			info.block.d(detaching);
    			info.token = null;
    			info = null;
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(30:40) ",
    		ctx
    	});

    	return block;
    }

    // (28:4) {#if contentHTML != null}
    function create_if_block_1(ctx) {
    	let contentasset;
    	let current;

    	contentasset = new ContentAsset({
    			props: { contentHTML: /*contentHTML*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(contentasset.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(contentasset.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(contentasset, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const contentasset_changes = {};
    			if (dirty & /*contentHTML*/ 2) contentasset_changes.contentHTML = /*contentHTML*/ ctx[1];
    			contentasset.$set(contentasset_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(contentasset.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(contentasset.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(contentasset, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(28:4) {#if contentHTML != null}",
    		ctx
    	});

    	return block;
    }

    // (35:8) {:catch error}
    function create_catch_block(ctx) {
    	const block = {
    		c: noop,
    		l: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_catch_block.name,
    		type: "catch",
    		source: "(35:8) {:catch error}",
    		ctx
    	});

    	return block;
    }

    // (33:8) {:then c}
    function create_then_block(ctx) {
    	let contentasset;
    	let current;

    	contentasset = new ContentAsset({
    			props: { contentComponent: /*c*/ ctx[7].default },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(contentasset.$$.fragment);
    		},
    		l: function claim(nodes) {
    			claim_component(contentasset.$$.fragment, nodes);
    		},
    		m: function mount(target, anchor) {
    			mount_component(contentasset, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const contentasset_changes = {};
    			if (dirty & /*lazyLoadComponent*/ 4) contentasset_changes.contentComponent = /*c*/ ctx[7].default;
    			contentasset.$set(contentasset_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(contentasset.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(contentasset.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(contentasset, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_then_block.name,
    		type: "then",
    		source: "(33:8) {:then c}",
    		ctx
    	});

    	return block;
    }

    // (31:34)               <!-- await -->          {:then c}
    function create_pending_block(ctx) {
    	const block = {
    		c: noop,
    		l: noop,
    		m: noop,
    		p: noop,
    		i: noop,
    		o: noop,
    		d: noop
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_pending_block.name,
    		type: "pending",
    		source: "(31:34)               <!-- await -->          {:then c}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$4(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*todayInRange*/ ctx[3] && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			if (if_block) if_block.l(nodes);
    			if_block_anchor = empty();
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_hydration_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*todayInRange*/ ctx[3]) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*todayInRange*/ 8) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function checkRange(startDate, endDate) {
    	// Convert to timestamp
    	let start = new Date(Date.parse(startDate)).getTime();

    	let end = new Date(Date.parse(endDate)).getTime();
    	let current = new Date().getTime();

    	// Return if today's date is between start date & end date
    	return current >= start && current <= end;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Scheduler', slots, []);
    	let { startDate = '', endDate = '', contentComponent = undefined, contentComponentFunction = undefined, contentHTML = undefined } = $$props;
    	let lazyLoadComponent, todayInRange;

    	if (checkRange(startDate, endDate)) {
    		if (contentComponentFunction) {
    			lazyLoadComponent = contentComponentFunction();
    		}

    		todayInRange = true;
    	}

    	const writable_props = [
    		'startDate',
    		'endDate',
    		'contentComponent',
    		'contentComponentFunction',
    		'contentHTML'
    	];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Scheduler> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('startDate' in $$props) $$invalidate(4, startDate = $$props.startDate);
    		if ('endDate' in $$props) $$invalidate(5, endDate = $$props.endDate);
    		if ('contentComponent' in $$props) $$invalidate(0, contentComponent = $$props.contentComponent);
    		if ('contentComponentFunction' in $$props) $$invalidate(6, contentComponentFunction = $$props.contentComponentFunction);
    		if ('contentHTML' in $$props) $$invalidate(1, contentHTML = $$props.contentHTML);
    	};

    	$$self.$capture_state = () => ({
    		ContentAsset,
    		startDate,
    		endDate,
    		contentComponent,
    		contentComponentFunction,
    		contentHTML,
    		lazyLoadComponent,
    		todayInRange,
    		checkRange
    	});

    	$$self.$inject_state = $$props => {
    		if ('startDate' in $$props) $$invalidate(4, startDate = $$props.startDate);
    		if ('endDate' in $$props) $$invalidate(5, endDate = $$props.endDate);
    		if ('contentComponent' in $$props) $$invalidate(0, contentComponent = $$props.contentComponent);
    		if ('contentComponentFunction' in $$props) $$invalidate(6, contentComponentFunction = $$props.contentComponentFunction);
    		if ('contentHTML' in $$props) $$invalidate(1, contentHTML = $$props.contentHTML);
    		if ('lazyLoadComponent' in $$props) $$invalidate(2, lazyLoadComponent = $$props.lazyLoadComponent);
    		if ('todayInRange' in $$props) $$invalidate(3, todayInRange = $$props.todayInRange);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		contentComponent,
    		contentHTML,
    		lazyLoadComponent,
    		todayInRange,
    		startDate,
    		endDate,
    		contentComponentFunction
    	];
    }

    class Scheduler extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init$1(this, options, instance$4, create_fragment$4, not_equal, {
    			startDate: 4,
    			endDate: 5,
    			contentComponent: 0,
    			contentComponentFunction: 6,
    			contentHTML: 1
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Scheduler",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get startDate() {
    		throw new Error("<Scheduler>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set startDate(value) {
    		throw new Error("<Scheduler>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get endDate() {
    		throw new Error("<Scheduler>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set endDate(value) {
    		throw new Error("<Scheduler>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get contentComponent() {
    		throw new Error("<Scheduler>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contentComponent(value) {
    		throw new Error("<Scheduler>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get contentComponentFunction() {
    		throw new Error("<Scheduler>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contentComponentFunction(value) {
    		throw new Error("<Scheduler>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get contentHTML() {
    		throw new Error("<Scheduler>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set contentHTML(value) {
    		throw new Error("<Scheduler>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const navStore = writable(true);

    /* src\Header.svelte generated by Svelte v3.44.1 */
    const file$3 = "src\\Header.svelte";

    // (146:4) <Button      type="submit"      name="home-email"      value="Sign Up"      class="email-alert-button button tertiary-alt">
    function create_default_slot(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("footer.sign-up");
    		},
    		l: function claim(nodes) {
    			t = claim_text(nodes, "footer.sign-up");
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, t, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(146:4) <Button      type=\\\"submit\\\"      name=\\\"home-email\\\"      value=\\\"Sign Up\\\"      class=\\\"email-alert-button button tertiary-alt\\\">",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div4;
    	let div0;
    	let scheduler0;
    	let t0;
    	let scheduler1;
    	let t1;
    	let div1;
    	let logo;
    	let t2;
    	let storelocator;
    	let t3;
    	let search;
    	let t4;
    	let linkmenu;
    	let t5;
    	let minicart;
    	let t6;
    	let div2;
    	let meganav;
    	let t7;
    	let button;
    	let t8;
    	let div3;
    	let scheduler2;
    	let t9;
    	let div5;
    	let current;

    	scheduler0 = new Scheduler({
    			props: {
    				startDate: "2021-06-09 09:30:00",
    				endDate: "2021-08-11 09:30:00",
    				contentComponentFunction: /*topBanner1*/ ctx[7]
    			},
    			$$inline: true
    		});

    	scheduler1 = new Scheduler({
    			props: {
    				startDate: "2021-08-11 09:30:01",
    				endDate: "2022-08-12 09:30:00",
    				contentComponentFunction: /*topBanner2*/ ctx[8]
    			},
    			$$inline: true
    		});

    	logo = new Logo({
    			props: { contentHTML: /*mainLogo*/ ctx[4] },
    			$$inline: true
    		});

    	storelocator = new StoreLocator({
    			props: {
    				storeName: "N Dale Mabry Hwy, Tampa",
    				storeHours: "OPEN TODAY AT 11:00 AM",
    				storeZip: "33609",
    				storeTime: "7:00 PM"
    			},
    			$$inline: true
    		});

    	search = new Search({
    			props: {
    				q: "q",
    				placeholder: "header.search.placeholder",
    				accessibility: "header.search.accessibility",
    				formAction: ""
    			},
    			$$inline: true
    		});

    	linkmenu = new Linkmenu({
    			props: { links: /*linksmenu*/ ctx[6] },
    			$$inline: true
    		});

    	minicart = new Minicart({
    			props: { list: /*minicartList*/ ctx[5] },
    			$$inline: true
    		});

    	meganav = new Meganav({
    			props: { links: /*links*/ ctx[0] },
    			$$inline: true
    		});

    	button = new Button({
    			props: {
    				type: "submit",
    				name: "home-email",
    				value: "Sign Up",
    				class: "email-alert-button button tertiary-alt",
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	scheduler2 = new Scheduler({
    			props: {
    				startDate: "2021-06-09 09:30:00",
    				endDate: "2022-06-09 09:30:00",
    				contentComponentFunction: /*topBannerBottom*/ ctx[9]
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div4 = element("div");
    			div0 = element("div");
    			create_component(scheduler0.$$.fragment);
    			t0 = space();
    			create_component(scheduler1.$$.fragment);
    			t1 = space();
    			div1 = element("div");
    			create_component(logo.$$.fragment);
    			t2 = space();
    			create_component(storelocator.$$.fragment);
    			t3 = space();
    			create_component(search.$$.fragment);
    			t4 = space();
    			create_component(linkmenu.$$.fragment);
    			t5 = space();
    			create_component(minicart.$$.fragment);
    			t6 = space();
    			div2 = element("div");
    			create_component(meganav.$$.fragment);
    			t7 = space();
    			create_component(button.$$.fragment);
    			t8 = space();
    			div3 = element("div");
    			create_component(scheduler2.$$.fragment);
    			t9 = space();
    			div5 = element("div");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div4 = claim_element(nodes, "DIV", { id: true, class: true, role: true });
    			var div4_nodes = children(div4);
    			div0 = claim_element(div4_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			claim_component(scheduler0.$$.fragment, div0_nodes);
    			t0 = claim_space(div0_nodes);
    			claim_component(scheduler1.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div4_nodes);
    			div1 = claim_element(div4_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			claim_component(logo.$$.fragment, div1_nodes);
    			t2 = claim_space(div1_nodes);
    			claim_component(storelocator.$$.fragment, div1_nodes);
    			t3 = claim_space(div1_nodes);
    			claim_component(search.$$.fragment, div1_nodes);
    			t4 = claim_space(div1_nodes);
    			claim_component(linkmenu.$$.fragment, div1_nodes);
    			t5 = claim_space(div1_nodes);
    			claim_component(minicart.$$.fragment, div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t6 = claim_space(div4_nodes);
    			div2 = claim_element(div4_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			claim_component(meganav.$$.fragment, div2_nodes);
    			div2_nodes.forEach(detach_dev);
    			t7 = claim_space(div4_nodes);
    			claim_component(button.$$.fragment, div4_nodes);
    			t8 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			claim_component(scheduler2.$$.fragment, div3_nodes);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t9 = claim_space(nodes);
    			div5 = claim_element(nodes, "DIV", { id: true, style: true, class: true });
    			children(div5).forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "class", "top-banner-container svelte-1iephzr");
    			add_location(div0, file$3, 111, 4, 4553);
    			attr_dev(div1, "class", "header-container svelte-1iephzr");
    			add_location(div1, file$3, 123, 4, 4947);
    			attr_dev(div2, "class", "main-nav svelte-1iephzr");
    			add_location(div2, file$3, 140, 4, 5499);
    			attr_dev(div3, "class", "trusted-banner-container");
    			add_location(div3, file$3, 155, 4, 5734);
    			attr_dev(div4, "id", "test-id");
    			attr_dev(div4, "class", "top-banner svelte-1iephzr");
    			attr_dev(div4, "role", "banner");
    			add_location(div4, file$3, 110, 0, 4477);
    			attr_dev(div5, "id", "header-overlay");
    			set_style(div5, "height", /*overlayHeight*/ ctx[3]);
    			attr_dev(div5, "class", "svelte-1iephzr");
    			toggle_class(div5, "active", /*overlayShow*/ ctx[2]);
    			add_location(div5, file$3, 163, 0, 5970);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div4, anchor);
    			append_hydration_dev(div4, div0);
    			mount_component(scheduler0, div0, null);
    			append_hydration_dev(div0, t0);
    			mount_component(scheduler1, div0, null);
    			append_hydration_dev(div4, t1);
    			append_hydration_dev(div4, div1);
    			mount_component(logo, div1, null);
    			append_hydration_dev(div1, t2);
    			mount_component(storelocator, div1, null);
    			append_hydration_dev(div1, t3);
    			mount_component(search, div1, null);
    			append_hydration_dev(div1, t4);
    			mount_component(linkmenu, div1, null);
    			append_hydration_dev(div1, t5);
    			mount_component(minicart, div1, null);
    			append_hydration_dev(div4, t6);
    			append_hydration_dev(div4, div2);
    			mount_component(meganav, div2, null);
    			append_hydration_dev(div4, t7);
    			mount_component(button, div4, null);
    			append_hydration_dev(div4, t8);
    			append_hydration_dev(div4, div3);
    			mount_component(scheduler2, div3, null);
    			/*div4_binding*/ ctx[10](div4);
    			insert_hydration_dev(target, t9, anchor);
    			insert_hydration_dev(target, div5, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const meganav_changes = {};
    			if (dirty & /*links*/ 1) meganav_changes.links = /*links*/ ctx[0];
    			meganav.$set(meganav_changes);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 4096) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);

    			if (!current || dirty & /*overlayHeight*/ 8) {
    				set_style(div5, "height", /*overlayHeight*/ ctx[3]);
    			}

    			if (dirty & /*overlayShow*/ 4) {
    				toggle_class(div5, "active", /*overlayShow*/ ctx[2]);
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(scheduler0.$$.fragment, local);
    			transition_in(scheduler1.$$.fragment, local);
    			transition_in(logo.$$.fragment, local);
    			transition_in(storelocator.$$.fragment, local);
    			transition_in(search.$$.fragment, local);
    			transition_in(linkmenu.$$.fragment, local);
    			transition_in(minicart.$$.fragment, local);
    			transition_in(meganav.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			transition_in(scheduler2.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(scheduler0.$$.fragment, local);
    			transition_out(scheduler1.$$.fragment, local);
    			transition_out(logo.$$.fragment, local);
    			transition_out(storelocator.$$.fragment, local);
    			transition_out(search.$$.fragment, local);
    			transition_out(linkmenu.$$.fragment, local);
    			transition_out(minicart.$$.fragment, local);
    			transition_out(meganav.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			transition_out(scheduler2.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div4);
    			destroy_component(scheduler0);
    			destroy_component(scheduler1);
    			destroy_component(logo);
    			destroy_component(storelocator);
    			destroy_component(search);
    			destroy_component(linkmenu);
    			destroy_component(minicart);
    			destroy_component(meganav);
    			destroy_component(button);
    			destroy_component(scheduler2);
    			/*div4_binding*/ ctx[10](null);
    			if (detaching) detach_dev(t9);
    			if (detaching) detach_dev(div5);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Header', slots, []);
    	let { links = [] } = $$props;
    	let banner, overlayShow, overlayHeight;

    	let mainLogo = `<picture>
                        <source srcset="https://www.ashleyfurniture.com/on/demandware.static/-/Library-Sites-AshcommSharedLibrary/default/dwb8b8f8f7/images/global/AshleyHomeStore_WebColors_Original.svg" media="(min-width: 480px)">
                        <img src="https://www.ashleyfurniture.com/on/demandware.static/-/Library-Sites-AshcommSharedLibrary/default/dw53fd8f0c/images/global/AHS_Icon.svg" alt="Ashley HomeStore">
                    </picture>`;

    	let minicartList = [
    		{
    			imgUrl: 'https://ashleyfurniture.scene7.com/is/image/AshleyFurniture/44401-38-10x8-CROP?$AFHS-PDP-Thumb-1X$',
    			url: 'https://www.ashleyfurniture.com/p/nandero_sofa/4440138.html',
    			name: 'Nadero Sofa',
    			sku: '4440138',
    			color: 'Mineral',
    			qty: 1,
    			price: 674.99
    		}
    	];

    	let linksmenu = [
    		{
    			url: 'https://www.ashleyfurniture.com/account/',
    			title: null,
    			//name: `${$t('header.links.log-in')}<br>${$t('header.links.account')}`,
    			name: `header.links.log-in - header.links.account`,
    			dropdown: `<ul class="user-links">
                    <li><a href="https://www.ashleyfurniture.com/orders/">header.links.orders</a></li>
                    <li><a href="https://www.ashleyfurniture.com/wishlist/">header.links.wish-list</a></li>
                    <li><a href="https://www.ashleyfurniture.com/account/">header.links.account</a></li>
                </ul>         
                <a href="https://www.ashleyfurniture.com/account/" class="redesign-button">header.links.create-account</a>`
    		},
    		{
    			url: '/ordertracking/',
    			//title: $t('header.links.delivery.alt'),
    			title: 'header.links.delivery.alt',
    			target: '_self',
    			//name: `${$t('header.links.delivery')}<br>${$t('header.links.tracking')}`
    			name: `header.links.delivery - header.links.tracking`
    		},
    		{
    			url: 'https://roombuilder.ashleyfurniture.com',
    			//title: $t('header.links.room.alt'),
    			title: 'header.links.room.alt',
    			//name: `${$t('header.links.room')}<br>${$t('header.links.builder')}`
    			name: `header.links.room - header.links.builder`
    		},
    		{
    			url: '/ask-ashley/',
    			//title: $t('header.links.help.alt'),
    			title: 'header.links.help.alt',
    			target: '_self',
    			//name: `<br>${$t('header.links.help')}`
    			name: `header.links.help`
    		},
    		{
    			url: 'https://www.ashleyfurniture.com/financing/',
    			//title: $t('header.links.financing.alt'),
    			title: 'header.links.financing.alt',
    			//name: `<br>${$t('header.links.financing')}`
    			name: `header.links.financing`
    		}
    	];

    	const topBanner1 = () => {
    		return Promise.resolve().then(function () { return topbannerasset1; });
    	};

    	const topBanner2 = () => {
    		return Promise.resolve().then(function () { return topbannerasset2; });
    	};

    	const topBannerBottom = () => {
    		return Promise.resolve().then(function () { return trustedbanner1; });
    	};

    	const unsubscribe = showOverlay.subscribe(value => {
    		$$invalidate(2, overlayShow = value);
    	});

    	onMount(() => {
    		let topBanner = document.querySelector('.top-banner');
    		$$invalidate(3, overlayHeight = Math.max(window.innerHeight, document.body.clientHeight) - topBanner.offsetTop - topBanner.offsetHeight + 'px');
    		navStore.set(false);
    	});

    	const writable_props = ['links'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Header> was created with unknown prop '${key}'`);
    	});

    	function div4_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			banner = $$value;
    			$$invalidate(1, banner);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    	};

    	$$self.$capture_state = () => ({
    		Search,
    		StoreLocator,
    		Logo,
    		Meganav,
    		Minicart,
    		Linkmenu,
    		showOverlay,
    		Scheduler,
    		navStore,
    		onMount,
    		links,
    		Button,
    		banner,
    		overlayShow,
    		overlayHeight,
    		mainLogo,
    		minicartList,
    		linksmenu,
    		topBanner1,
    		topBanner2,
    		topBannerBottom,
    		unsubscribe
    	});

    	$$self.$inject_state = $$props => {
    		if ('links' in $$props) $$invalidate(0, links = $$props.links);
    		if ('banner' in $$props) $$invalidate(1, banner = $$props.banner);
    		if ('overlayShow' in $$props) $$invalidate(2, overlayShow = $$props.overlayShow);
    		if ('overlayHeight' in $$props) $$invalidate(3, overlayHeight = $$props.overlayHeight);
    		if ('mainLogo' in $$props) $$invalidate(4, mainLogo = $$props.mainLogo);
    		if ('minicartList' in $$props) $$invalidate(5, minicartList = $$props.minicartList);
    		if ('linksmenu' in $$props) $$invalidate(6, linksmenu = $$props.linksmenu);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		links,
    		banner,
    		overlayShow,
    		overlayHeight,
    		mainLogo,
    		minicartList,
    		linksmenu,
    		topBanner1,
    		topBanner2,
    		topBannerBottom,
    		div4_binding
    	];
    }

    class Header extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$3, create_fragment$3, not_equal, { links: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Header",
    			options,
    			id: create_fragment$3.name
    		});
    	}

    	get links() {
    		throw new Error("<Header>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set links(value) {
    		throw new Error("<Header>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src\assets\topbannercontent\topbannerasset1.svelte generated by Svelte v3.44.1 */

    const file$2 = "src\\assets\\topbannercontent\\topbannerasset1.svelte";

    function create_fragment$2(ctx) {
    	let div10;
    	let div9;
    	let div2;
    	let div1;
    	let a0;
    	let t0;
    	let t1;
    	let div0;
    	let a1;
    	let t2;
    	let t3;
    	let div5;
    	let div4;
    	let a2;
    	let t4;
    	let t5;
    	let div3;
    	let a3;
    	let t6;
    	let t7;
    	let div8;
    	let div7;
    	let a4;
    	let t8;
    	let t9;
    	let div6;
    	let a5;
    	let t10;

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			a0 = element("a");
    			t0 = text("In-Stock & Ready to Ship up to 60% Off*");
    			t1 = space();
    			div0 = element("div");
    			a1 = element("a");
    			t2 = text("Shop Now");
    			t3 = space();
    			div5 = element("div");
    			div4 = element("div");
    			a2 = element("a");
    			t4 = text("Outdoor Price Cuts Up to 50% Off*");
    			t5 = space();
    			div3 = element("div");
    			a3 = element("a");
    			t6 = text("Shop Now");
    			t7 = space();
    			div8 = element("div");
    			div7 = element("div");
    			a4 = element("a");
    			t8 = text("Shop Limited Time Flash Deals");
    			t9 = space();
    			div6 = element("div");
    			a5 = element("a");
    			t10 = text("Shop Now");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div10 = claim_element(nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div2 = claim_element(div9_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			a0 = claim_element(div1_nodes, "A", { href: true, class: true });
    			var a0_nodes = children(a0);
    			t0 = claim_text(a0_nodes, "In-Stock & Ready to Ship up to 60% Off*");
    			a0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			a1 = claim_element(div0_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			t2 = claim_text(a1_nodes, "Shop Now");
    			a1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t3 = claim_space(div9_nodes);
    			div5 = claim_element(div9_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			a2 = claim_element(div4_nodes, "A", { href: true, class: true });
    			var a2_nodes = children(a2);
    			t4 = claim_text(a2_nodes, "Outdoor Price Cuts Up to 50% Off*");
    			a2_nodes.forEach(detach_dev);
    			t5 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			a3 = claim_element(div3_nodes, "A", { href: true, class: true });
    			var a3_nodes = children(a3);
    			t6 = claim_text(a3_nodes, "Shop Now");
    			a3_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t7 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			a4 = claim_element(div7_nodes, "A", { href: true, class: true });
    			var a4_nodes = children(a4);
    			t8 = claim_text(a4_nodes, "Shop Limited Time Flash Deals");
    			a4_nodes.forEach(detach_dev);
    			t9 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true, style: true });
    			var div6_nodes = children(div6);
    			a5 = claim_element(div6_nodes, "A", { href: true, class: true });
    			var a5_nodes = children(a5);
    			t10 = claim_text(a5_nodes, "Shop Now");
    			a5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a0, "href", "/c/deals/top-picks/");
    			attr_dev(a0, "class", "svelte-1uivco5");
    			add_location(a0, file$2, 4, 16, 169);
    			attr_dev(a1, "href", "/c/deals/top-picks/");
    			attr_dev(a1, "class", "svelte-1uivco5");
    			add_location(a1, file$2, 6, 20, 348);
    			attr_dev(div0, "class", "tribanner-drop-down svelte-1uivco5");
    			set_style(div0, "background", "#dc6901");
    			add_location(div0, file$2, 5, 16, 264);
    			attr_dev(div1, "class", "orange desktop-item svelte-1uivco5");
    			add_location(div1, file$2, 3, 12, 118);
    			attr_dev(div2, "class", "desktop-item-slide svelte-1uivco5");
    			add_location(div2, file$2, 2, 8, 72);
    			attr_dev(a2, "href", "/c/outdoor/outdoor-seating/");
    			attr_dev(a2, "class", "svelte-1uivco5");
    			add_location(a2, file$2, 12, 16, 560);
    			attr_dev(a3, "href", "/c/outdoor/outdoor-seating/");
    			attr_dev(a3, "class", "svelte-1uivco5");
    			add_location(a3, file$2, 14, 20, 737);
    			attr_dev(div3, "class", "tribanner-drop-down svelte-1uivco5");
    			set_style(div3, "background", "#3F4045");
    			add_location(div3, file$2, 13, 16, 653);
    			attr_dev(div4, "class", "dark-gray desktop-item svelte-1uivco5");
    			add_location(div4, file$2, 11, 12, 506);
    			attr_dev(div5, "class", "desktop-item-slide svelte-1uivco5");
    			add_location(div5, file$2, 10, 8, 460);
    			attr_dev(a4, "href", "/c/deals/");
    			attr_dev(a4, "class", "svelte-1uivco5");
    			add_location(a4, file$2, 20, 16, 958);
    			attr_dev(a5, "href", "/c/deals/");
    			attr_dev(a5, "class", "svelte-1uivco5");
    			add_location(a5, file$2, 21, 78, 1091);
    			attr_dev(div6, "class", "tribanner-drop-down svelte-1uivco5");
    			set_style(div6, "background", "#CCCDCE");
    			add_location(div6, file$2, 21, 16, 1029);
    			attr_dev(div7, "class", "light-gray desktop-item svelte-1uivco5");
    			add_location(div7, file$2, 19, 12, 903);
    			attr_dev(div8, "class", "desktop-item-slide svelte-1uivco5");
    			add_location(div8, file$2, 18, 8, 857);
    			attr_dev(div9, "class", "tri-banner svelte-1uivco5");
    			add_location(div9, file$2, 1, 4, 38);
    			attr_dev(div10, "class", "tri-banner-desktop svelte-1uivco5");
    			add_location(div10, file$2, 0, 0, 0);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div10, anchor);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, a0);
    			append_hydration_dev(a0, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a1);
    			append_hydration_dev(a1, t2);
    			append_hydration_dev(div9, t3);
    			append_hydration_dev(div9, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, a2);
    			append_hydration_dev(a2, t4);
    			append_hydration_dev(div4, t5);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, a3);
    			append_hydration_dev(a3, t6);
    			append_hydration_dev(div9, t7);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, a4);
    			append_hydration_dev(a4, t8);
    			append_hydration_dev(div7, t9);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, a5);
    			append_hydration_dev(a5, t10);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Topbannerasset1', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Topbannerasset1> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Topbannerasset1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$2, create_fragment$2, not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Topbannerasset1",
    			options,
    			id: create_fragment$2.name
    		});
    	}
    }

    var topbannerasset1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': Topbannerasset1
    });

    /* src\assets\topbannercontent\topbannerasset2.svelte generated by Svelte v3.44.1 */

    const file$1 = "src\\assets\\topbannercontent\\topbannerasset2.svelte";

    function create_fragment$1(ctx) {
    	let div10;
    	let div9;
    	let div2;
    	let div1;
    	let a0;
    	let t0;
    	let t1;
    	let div0;
    	let a1;
    	let t2;
    	let t3;
    	let div5;
    	let div4;
    	let a2;
    	let t4;
    	let t5;
    	let div3;
    	let a3;
    	let t6;
    	let t7;
    	let div8;
    	let div7;
    	let a4;
    	let t8;
    	let t9;
    	let div6;
    	let a5;
    	let t10;

    	const block = {
    		c: function create() {
    			div10 = element("div");
    			div9 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			a0 = element("a");
    			t0 = text("In-Stock & Ready to Ship up to 30% Off*");
    			t1 = space();
    			div0 = element("div");
    			a1 = element("a");
    			t2 = text("Shop Now");
    			t3 = space();
    			div5 = element("div");
    			div4 = element("div");
    			a2 = element("a");
    			t4 = text("NEW! Outdoor Price Cuts Up to 70% Off*");
    			t5 = space();
    			div3 = element("div");
    			a3 = element("a");
    			t6 = text("Shop Now");
    			t7 = space();
    			div8 = element("div");
    			div7 = element("div");
    			a4 = element("a");
    			t8 = text("NEW!! Shop Limited Time Flash Deals");
    			t9 = space();
    			div6 = element("div");
    			a5 = element("a");
    			t10 = text("Shop Now");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div10 = claim_element(nodes, "DIV", { class: true });
    			var div10_nodes = children(div10);
    			div9 = claim_element(div10_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div2 = claim_element(div9_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			div1 = claim_element(div2_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			a0 = claim_element(div1_nodes, "A", { href: true, class: true });
    			var a0_nodes = children(a0);
    			t0 = claim_text(a0_nodes, "In-Stock & Ready to Ship up to 30% Off*");
    			a0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			div0 = claim_element(div1_nodes, "DIV", { class: true, style: true });
    			var div0_nodes = children(div0);
    			a1 = claim_element(div0_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			t2 = claim_text(a1_nodes, "Shop Now");
    			a1_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t3 = claim_space(div9_nodes);
    			div5 = claim_element(div9_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);
    			a2 = claim_element(div4_nodes, "A", { href: true, class: true });
    			var a2_nodes = children(a2);
    			t4 = claim_text(a2_nodes, "NEW! Outdoor Price Cuts Up to 70% Off*");
    			a2_nodes.forEach(detach_dev);
    			t5 = claim_space(div4_nodes);
    			div3 = claim_element(div4_nodes, "DIV", { class: true, style: true });
    			var div3_nodes = children(div3);
    			a3 = claim_element(div3_nodes, "A", { href: true, class: true });
    			var a3_nodes = children(a3);
    			t6 = claim_text(a3_nodes, "Shop Now");
    			a3_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t7 = claim_space(div9_nodes);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			div7 = claim_element(div8_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);
    			a4 = claim_element(div7_nodes, "A", { href: true, class: true });
    			var a4_nodes = children(a4);
    			t8 = claim_text(a4_nodes, "NEW!! Shop Limited Time Flash Deals");
    			a4_nodes.forEach(detach_dev);
    			t9 = claim_space(div7_nodes);
    			div6 = claim_element(div7_nodes, "DIV", { class: true, style: true });
    			var div6_nodes = children(div6);
    			a5 = claim_element(div6_nodes, "A", { href: true, class: true });
    			var a5_nodes = children(a5);
    			t10 = claim_text(a5_nodes, "Shop Now");
    			a5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			div10_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a0, "href", "/c/deals/top-picks/");
    			attr_dev(a0, "class", "svelte-12ikqam");
    			add_location(a0, file$1, 4, 16, 169);
    			attr_dev(a1, "href", "/c/deals/top-picks/");
    			attr_dev(a1, "class", "svelte-12ikqam");
    			add_location(a1, file$1, 6, 20, 348);
    			attr_dev(div0, "class", "tribanner-drop-down svelte-12ikqam");
    			set_style(div0, "background", "#dc6901");
    			add_location(div0, file$1, 5, 16, 264);
    			attr_dev(div1, "class", "orange desktop-item svelte-12ikqam");
    			add_location(div1, file$1, 3, 12, 118);
    			attr_dev(div2, "class", "desktop-item-slide svelte-12ikqam");
    			add_location(div2, file$1, 2, 8, 72);
    			attr_dev(a2, "href", "/c/outdoor/outdoor-seating/");
    			attr_dev(a2, "class", "svelte-12ikqam");
    			add_location(a2, file$1, 12, 16, 560);
    			attr_dev(a3, "href", "/c/outdoor/outdoor-seating/");
    			attr_dev(a3, "class", "svelte-12ikqam");
    			add_location(a3, file$1, 14, 20, 742);
    			attr_dev(div3, "class", "tribanner-drop-down svelte-12ikqam");
    			set_style(div3, "background", "#3F4045");
    			add_location(div3, file$1, 13, 16, 658);
    			attr_dev(div4, "class", "dark-gray desktop-item svelte-12ikqam");
    			add_location(div4, file$1, 11, 12, 506);
    			attr_dev(div5, "class", "desktop-item-slide svelte-12ikqam");
    			add_location(div5, file$1, 10, 8, 460);
    			attr_dev(a4, "href", "/c/deals/");
    			attr_dev(a4, "class", "svelte-12ikqam");
    			add_location(a4, file$1, 20, 16, 963);
    			attr_dev(a5, "href", "/c/deals/");
    			attr_dev(a5, "class", "svelte-12ikqam");
    			add_location(a5, file$1, 21, 78, 1102);
    			attr_dev(div6, "class", "tribanner-drop-down svelte-12ikqam");
    			set_style(div6, "background", "#CCCDCE");
    			add_location(div6, file$1, 21, 16, 1040);
    			attr_dev(div7, "class", "light-gray desktop-item svelte-12ikqam");
    			add_location(div7, file$1, 19, 12, 908);
    			attr_dev(div8, "class", "desktop-item-slide svelte-12ikqam");
    			add_location(div8, file$1, 18, 8, 862);
    			attr_dev(div9, "class", "tri-banner svelte-12ikqam");
    			add_location(div9, file$1, 1, 4, 38);
    			attr_dev(div10, "class", "tri-banner-desktop svelte-12ikqam");
    			add_location(div10, file$1, 0, 0, 0);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div10, anchor);
    			append_hydration_dev(div10, div9);
    			append_hydration_dev(div9, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, a0);
    			append_hydration_dev(a0, t0);
    			append_hydration_dev(div1, t1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a1);
    			append_hydration_dev(a1, t2);
    			append_hydration_dev(div9, t3);
    			append_hydration_dev(div9, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, a2);
    			append_hydration_dev(a2, t4);
    			append_hydration_dev(div4, t5);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, a3);
    			append_hydration_dev(a3, t6);
    			append_hydration_dev(div9, t7);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, div7);
    			append_hydration_dev(div7, a4);
    			append_hydration_dev(a4, t8);
    			append_hydration_dev(div7, t9);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, a5);
    			append_hydration_dev(a5, t10);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div10);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Topbannerasset2', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Topbannerasset2> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Topbannerasset2 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance$1, create_fragment$1, not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Topbannerasset2",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    var topbannerasset2 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': Topbannerasset2
    });

    /* src\assets\trustedbanner\trustedbanner1.svelte generated by Svelte v3.44.1 */

    const file = "src\\assets\\trustedbanner\\trustedbanner1.svelte";

    function create_fragment(ctx) {
    	let div7;
    	let div2;
    	let div1;
    	let div0;
    	let a0;
    	let img0;
    	let img0_src_value;
    	let t0;
    	let t1;
    	let div4;
    	let div3;
    	let img1;
    	let img1_src_value;
    	let t2;
    	let a1;
    	let t3;
    	let div6;
    	let div5;
    	let img2;
    	let img2_src_value;
    	let t4;
    	let a2;
    	let t5;

    	const block = {
    		c: function create() {
    			div7 = element("div");
    			div2 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			a0 = element("a");
    			img0 = element("img");
    			t0 = text("chat with a personal online sales assistant");
    			t1 = space();
    			div4 = element("div");
    			div3 = element("div");
    			img1 = element("img");
    			t2 = text("\r\n            shop by phone\r\n            ");
    			a1 = element("a");
    			t3 = space();
    			div6 = element("div");
    			div5 = element("div");
    			img2 = element("img");
    			t4 = space();
    			a2 = element("a");
    			t5 = text("schedule a private in-store appointment");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div7 = claim_element(nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);

    			div2 = claim_element(div7_nodes, "DIV", {
    				id: true,
    				style: true,
    				title: true,
    				"aria-label": true,
    				class: true
    			});

    			var div2_nodes = children(div2);

    			div1 = claim_element(div2_nodes, "DIV", {
    				id: true,
    				class: true,
    				role: true,
    				tabindex: true,
    				style: true
    			});

    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", {});
    			var div0_nodes = children(div0);

    			a0 = claim_element(div0_nodes, "A", {
    				href: true,
    				"data-lp-event": true,
    				style: true,
    				class: true
    			});

    			var a0_nodes = children(a0);
    			img0 = claim_element(a0_nodes, "IMG", { src: true, class: true });
    			t0 = claim_text(a0_nodes, "chat with a personal online sales assistant");
    			a0_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			div1_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			t1 = claim_space(div7_nodes);
    			div4 = claim_element(div7_nodes, "DIV", { class: true, style: true });
    			var div4_nodes = children(div4);
    			div3 = claim_element(div4_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			img1 = claim_element(div3_nodes, "IMG", { src: true, class: true });
    			t2 = claim_text(div3_nodes, "\r\n            shop by phone\r\n            ");

    			a1 = claim_element(div3_nodes, "A", {
    				class: true,
    				style: true,
    				href: true,
    				title: true,
    				"aria-label": true
    			});

    			children(a1).forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			t3 = claim_space(div7_nodes);

    			div6 = claim_element(div7_nodes, "DIV", {
    				class: true,
    				style: true,
    				title: true,
    				"aria-label": true
    			});

    			var div6_nodes = children(div6);
    			div5 = claim_element(div6_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			img2 = claim_element(div5_nodes, "IMG", { src: true, class: true });
    			t4 = claim_space(div5_nodes);

    			a2 = claim_element(div5_nodes, "A", {
    				class: true,
    				target: true,
    				href: true,
    				style: true
    			});

    			var a2_nodes = children(a2);
    			t5 = claim_text(a2_nodes, "schedule a private in-store appointment");
    			a2_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			div6_nodes.forEach(detach_dev);
    			div7_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			if (!src_url_equal(img0.src, img0_src_value = "https://www.ashleyfurniture.com/on/demandware.static/-/Library-Sites-AshcommSharedLibrary/default/images/homepage/homepage-ways-to-shop/banner_speech_bubble_icon.png")) attr_dev(img0, "src", img0_src_value);
    			attr_dev(img0, "class", "svelte-1kujynm");
    			add_location(img0, file, 17, 21, 977);
    			attr_dev(a0, "href", "#");
    			attr_dev(a0, "data-lp-event", "click");
    			set_style(a0, "font-weight", "400");
    			set_style(a0, "color", "white");
    			set_style(a0, "text-decoration", "none");
    			attr_dev(a0, "class", "svelte-1kujynm");
    			add_location(a0, file, 16, 16, 858);
    			add_location(div0, file, 15, 12, 835);
    			attr_dev(div1, "id", "LPMcontainer-1619092577434-0");
    			attr_dev(div1, "class", "LPMcontainer LPMoverlay svelte-1kujynm");
    			attr_dev(div1, "role", "button");
    			attr_dev(div1, "tabindex", "0");
    			set_style(div1, "margin", "1px");
    			set_style(div1, "padding", "0px");
    			set_style(div1, "border-style", "solid");
    			set_style(div1, "border-width", "0px");
    			set_style(div1, "font-style", "normal");
    			set_style(div1, "font-weight", "normal");
    			set_style(div1, "font-variant", "normal");
    			set_style(div1, "list-style", "outside none none");
    			set_style(div1, "letter-spacing", "normal");
    			set_style(div1, "text-decoration", "none");
    			set_style(div1, "vertical-align", "baseline");
    			set_style(div1, "white-space", "normal");
    			set_style(div1, "word-spacing", "normal");
    			set_style(div1, "background-repeat", "repeat-x");
    			set_style(div1, "background-position", "left bottom");
    			set_style(div1, "cursor", "auto");
    			set_style(div1, "display", "block");
    			add_location(div1, file, 8, 8, 270);
    			attr_dev(div2, "id", "sslp-global-sticky-banner");
    			set_style(div2, "text-decoration", "none");
    			set_style(div2, "cursor", "pointer");
    			set_style(div2, "width", "50%");
    			attr_dev(div2, "title", "Lets Connect");
    			attr_dev(div2, "aria-label", "Lets Connect");
    			attr_dev(div2, "class", "slick-head-banner");
    			add_location(div2, file, 1, 4, 40);
    			if (!src_url_equal(img1.src, img1_src_value = "https://www.ashleyfurniture.com/on/demandware.static/-/Library-Sites-AshcommSharedLibrary/default/dwfd51de93/images/homepage/homepage-ways-to-shop/banner_telephone_icon.png")) attr_dev(img1, "src", img1_src_value);
    			attr_dev(img1, "class", "svelte-1kujynm");
    			add_location(img1, file, 29, 12, 1562);
    			attr_dev(a1, "class", "sales-team-phone phone");
    			set_style(a1, "margin-left", "5px");
    			attr_dev(a1, "href", "");
    			attr_dev(a1, "title", "Sales Experts Team Phone Number");
    			attr_dev(a1, "aria-label", "Sales Experts Team Phone Number");
    			add_location(a1, file, 33, 12, 1819);
    			attr_dev(div3, "class", "help-trusted-advisor-sales slick-body-banner");
    			add_location(div3, file, 28, 8, 1490);
    			attr_dev(div4, "class", "help-trusted-advisor-style shop-by-phone slick-head-banner border-left visually-hidden");
    			set_style(div4, "display", "none");
    			set_style(div4, "width", "50%");
    			add_location(div4, file, 24, 4, 1321);
    			if (!src_url_equal(img2.src, img2_src_value = "https://www.ashleyfurniture.com/on/demandware.static/-/Library-Sites-AshcommSharedLibrary/default/dwbfacc366/images/homepage/homepage-ways-to-shop/banner_calendar_icon.png")) attr_dev(img2, "src", img2_src_value);
    			attr_dev(img2, "class", "svelte-1kujynm");
    			add_location(img2, file, 49, 12, 2409);
    			attr_dev(a2, "class", "shop-by-appointment-url");
    			attr_dev(a2, "target", "_blank");
    			attr_dev(a2, "href", "https://www04.timetrade.com/app/ashleyfurniture/workflows/ashleyfurniture001/schedule?ch=web&appointmentTypeGroupId=rsa&locationId=8888300-319");
    			set_style(a2, "font-family", "'Open Sans', Arial, sans-serif");
    			set_style(a2, "font-weight", "400");
    			set_style(a2, "color", "#fff");
    			set_style(a2, "text-decoration", "none");
    			set_style(a2, "cursor", "pointer");
    			add_location(a2, file, 52, 12, 2638);
    			attr_dev(div5, "class", "slick-body-banner");
    			add_location(div5, file, 48, 8, 2364);
    			attr_dev(div6, "class", "instore-appointment shop-by-appointment slick-head-banner border-left");
    			set_style(div6, "text-decoration", "none");
    			set_style(div6, "cursor", "pointer");
    			set_style(div6, "width", "50%");
    			attr_dev(div6, "title", "In-store Appointment");
    			attr_dev(div6, "aria-label", "In-store Appointment");
    			add_location(div6, file, 42, 4, 2106);
    			attr_dev(div7, "class", "trusted-banner-slick svelte-1kujynm");
    			add_location(div7, file, 0, 0, 0);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div7, anchor);
    			append_hydration_dev(div7, div2);
    			append_hydration_dev(div2, div1);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, a0);
    			append_hydration_dev(a0, img0);
    			append_hydration_dev(a0, t0);
    			append_hydration_dev(div7, t1);
    			append_hydration_dev(div7, div4);
    			append_hydration_dev(div4, div3);
    			append_hydration_dev(div3, img1);
    			append_hydration_dev(div3, t2);
    			append_hydration_dev(div3, a1);
    			append_hydration_dev(div7, t3);
    			append_hydration_dev(div7, div6);
    			append_hydration_dev(div6, div5);
    			append_hydration_dev(div5, img2);
    			append_hydration_dev(div5, t4);
    			append_hydration_dev(div5, a2);
    			append_hydration_dev(a2, t5);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div7);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Trustedbanner1', slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Trustedbanner1> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Trustedbanner1 extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init$1(this, options, instance, create_fragment, not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Trustedbanner1",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    var trustedbanner1 = /*#__PURE__*/Object.freeze({
        __proto__: null,
        'default': Trustedbanner1
    });

    return Header;

})();
//# sourceMappingURL=Header.js.map
