var Footer = (function () {
    'use strict';

    function noop() { }
    function assign(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
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
    function not_equal(a, b) {
        return a != a ? b == b : a !== b;
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
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
    function toggle_class(element, name, toggle) {
        element.classList[toggle ? 'add' : 'remove'](name);
    }
    function custom_event(type, detail, bubbles = false) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, false, detail);
        return e;
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
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
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

    function bind(component, name, callback) {
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
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
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

    /* node_modules\ashcomm-core-svelte\SVG\flag-america-thumbnail.svelte generated by Svelte v3.44.1 */

    const file$b = "node_modules\\ashcomm-core-svelte\\SVG\\flag-america-thumbnail.svelte";

    function create_fragment$b(ctx) {
    	let svg;
    	let defs;
    	let style;
    	let t;
    	let g;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let path7;
    	let line0;
    	let path8;
    	let path9;
    	let path10;
    	let path11;
    	let path12;
    	let path13;
    	let path14;
    	let path15;
    	let line1;
    	let path16;
    	let path17;
    	let path18;
    	let path19;
    	let path20;
    	let path21;
    	let path22;
    	let path23;
    	let path24;
    	let path25;
    	let path26;
    	let path27;
    	let path28;
    	let path29;
    	let path30;
    	let path31;
    	let path32;
    	let path33;
    	let path34;
    	let path35;
    	let path36;
    	let path37;
    	let path38;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			style = svg_element("style");
    			t = text(".a{fill:#ed1c24;}.b{fill:#fff;}.c{fill:#21409a;}.d{fill:#231f20;}");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			line0 = svg_element("line");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			path10 = svg_element("path");
    			path11 = svg_element("path");
    			path12 = svg_element("path");
    			path13 = svg_element("path");
    			path14 = svg_element("path");
    			path15 = svg_element("path");
    			line1 = svg_element("line");
    			path16 = svg_element("path");
    			path17 = svg_element("path");
    			path18 = svg_element("path");
    			path19 = svg_element("path");
    			path20 = svg_element("path");
    			path21 = svg_element("path");
    			path22 = svg_element("path");
    			path23 = svg_element("path");
    			path24 = svg_element("path");
    			path25 = svg_element("path");
    			path26 = svg_element("path");
    			path27 = svg_element("path");
    			path28 = svg_element("path");
    			path29 = svg_element("path");
    			path30 = svg_element("path");
    			path31 = svg_element("path");
    			path32 = svg_element("path");
    			path33 = svg_element("path");
    			path34 = svg_element("path");
    			path35 = svg_element("path");
    			path36 = svg_element("path");
    			path37 = svg_element("path");
    			path38 = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			defs = claim_svg_element(svg_nodes, "defs", {});
    			var defs_nodes = children(defs);
    			style = claim_svg_element(defs_nodes, "style", {});
    			var style_nodes = children(style);
    			t = claim_text(style_nodes, ".a{fill:#ed1c24;}.b{fill:#fff;}.c{fill:#21409a;}.d{fill:#231f20;}");
    			style_nodes.forEach(detach_dev);
    			defs_nodes.forEach(detach_dev);
    			g = claim_svg_element(svg_nodes, "g", { transform: true });
    			var g_nodes = children(g);
    			path0 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path0).forEach(detach_dev);
    			path1 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path1).forEach(detach_dev);
    			path2 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path2).forEach(detach_dev);
    			path3 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path3).forEach(detach_dev);
    			path4 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path4).forEach(detach_dev);
    			path5 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path5).forEach(detach_dev);
    			path6 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path6).forEach(detach_dev);
    			path7 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path7).forEach(detach_dev);
    			line0 = claim_svg_element(g_nodes, "line", { class: true, y1: true, transform: true });
    			children(line0).forEach(detach_dev);
    			path8 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path8).forEach(detach_dev);
    			path9 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path9).forEach(detach_dev);
    			path10 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path10).forEach(detach_dev);
    			path11 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path11).forEach(detach_dev);
    			path12 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path12).forEach(detach_dev);
    			path13 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path13).forEach(detach_dev);
    			path14 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path14).forEach(detach_dev);
    			path15 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path15).forEach(detach_dev);
    			line1 = claim_svg_element(g_nodes, "line", { class: true, y1: true, transform: true });
    			children(line1).forEach(detach_dev);
    			path16 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path16).forEach(detach_dev);
    			path17 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path17).forEach(detach_dev);
    			path18 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path18).forEach(detach_dev);
    			path19 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path19).forEach(detach_dev);
    			path20 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path20).forEach(detach_dev);
    			path21 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path21).forEach(detach_dev);
    			path22 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path22).forEach(detach_dev);
    			path23 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path23).forEach(detach_dev);
    			path24 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path24).forEach(detach_dev);
    			path25 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path25).forEach(detach_dev);
    			path26 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path26).forEach(detach_dev);
    			path27 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path27).forEach(detach_dev);
    			path28 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path28).forEach(detach_dev);
    			path29 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path29).forEach(detach_dev);
    			path30 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path30).forEach(detach_dev);
    			path31 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path31).forEach(detach_dev);
    			path32 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path32).forEach(detach_dev);
    			path33 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path33).forEach(detach_dev);
    			path34 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path34).forEach(detach_dev);
    			path35 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path35).forEach(detach_dev);
    			path36 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path36).forEach(detach_dev);
    			path37 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path37).forEach(detach_dev);
    			path38 = claim_svg_element(g_nodes, "path", { class: true, d: true, transform: true });
    			children(path38).forEach(detach_dev);
    			g_nodes.forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(style, file$b, 6, 124, 237);
    			add_location(defs, file$b, 6, 118, 231);
    			attr_dev(path0, "class", "a");
    			attr_dev(path0, "d", "M50.13,20.88H62.595a13.85,13.85,0,0,0-1.686-2.53H50.13Z");
    			attr_dev(path0, "transform", "translate(-36.139 -13.222)");
    			add_location(path0, file$b, 6, 245, 358);
    			attr_dev(path1, "class", "b");
    			attr_dev(path1, "d", "M50.13,29.93H63.584a14.033,14.033,0,0,0-1-2.53H50.13Z");
    			attr_dev(path1, "transform", "translate(-36.139 -19.729)");
    			add_location(path1, file$b, 6, 361, 474);
    			attr_dev(path2, "class", "a");
    			attr_dev(path2, "d", "M50.13,38.944H64.065a14.1,14.1,0,0,0-.481-2.544H50.13Z");
    			attr_dev(path2, "transform", "translate(-36.139 -26.199)");
    			add_location(path2, file$b, 6, 475, 588);
    			attr_dev(path3, "class", "b");
    			attr_dev(path3, "d", "M50.13,48H64.065c.037-.422.056-.843.056-1.273s-.02-.843-.056-1.273H50.13Z");
    			attr_dev(path3, "transform", "translate(-36.139 -32.706)");
    			add_location(path3, file$b, 6, 590, 703);
    			attr_dev(path4, "class", "a");
    			attr_dev(path4, "d", "M29.547,93.254a13.932,13.932,0,0,0,8.047-2.544H21.5A13.932,13.932,0,0,0,29.547,93.254Z");
    			attr_dev(path4, "transform", "translate(-15.556 -65.245)");
    			add_location(path4, file$b, 6, 724, 837);
    			attr_dev(path5, "class", "b");
    			attr_dev(path5, "d", "M14.476,84.24H30.569a14.052,14.052,0,0,0,2.746-2.53H11.73a14.126,14.126,0,0,0,2.746,2.53Z");
    			attr_dev(path5, "transform", "translate(-8.532 -58.775)");
    			add_location(path5, file$b, 6, 871, 984);
    			attr_dev(path6, "class", "a");
    			attr_dev(path6, "d", "M7.452,75.19H29.037a13.851,13.851,0,0,0,1.686-2.53H5.78a13.851,13.851,0,0,0,1.672,2.53Z");
    			attr_dev(path6, "transform", "translate(-4.254 -52.268)");
    			add_location(path6, file$b, 6, 1020, 1133);
    			attr_dev(path7, "class", "b");
    			attr_dev(path7, "d", "M3.221,66.14H28.15a14.033,14.033,0,0,0,1-2.53H2.22a14.033,14.033,0,0,0,1,2.53Z");
    			attr_dev(path7, "transform", "translate(-1.694 -45.762)");
    			add_location(path7, file$b, 6, 1167, 1280);
    			attr_dev(line0, "class", "b");
    			attr_dev(line0, "y1", "2.544");
    			attr_dev(line0, "transform", "translate(13.991 2.57)");
    			add_location(line0, file$b, 6, 1305, 1418);
    			attr_dev(path8, "class", "b");
    			attr_dev(path8, "d", "M14.476,9.25a14.126,14.126,0,0,0-2.746,2.544");
    			attr_dev(path8, "transform", "translate(-8.532 -6.68)");
    			add_location(path8, file$b, 6, 1368, 1481);
    			attr_dev(path9, "class", "b");
    			attr_dev(path9, "d", "M49.78,38.814h0V36.27");
    			attr_dev(path9, "transform", "translate(-35.789 -26.069)");
    			add_location(path9, file$b, 6, 1470, 1583);
    			attr_dev(path10, "class", "b");
    			attr_dev(path10, "d", "M1.019,36.4A14.1,14.1,0,0,0,.55,38.944");
    			attr_dev(path10, "transform", "translate(-0.494 -26.199)");
    			add_location(path10, file$b, 6, 1552, 1665);
    			attr_dev(path11, "class", "b");
    			attr_dev(path11, "d", "M.406,45.45c-.037.419-.056.843-.056,1.273S.37,47.566.406,48H14.341V45.45h0");
    			attr_dev(path11, "transform", "translate(-0.35 -32.706)");
    			add_location(path11, file$b, 6, 1650, 1763);
    			attr_dev(path12, "class", "a");
    			attr_dev(path12, "d", "M14.485,54.51H.55a14.1,14.1,0,0,0,.469,2.544h26.92a14.1,14.1,0,0,0,.469-2.544Z");
    			attr_dev(path12, "transform", "translate(-0.494 -39.219)");
    			add_location(path12, file$b, 6, 1783, 1896);
    			attr_dev(path13, "class", "a");
    			attr_dev(path13, "d", "M58.177,2.744A13.932,13.932,0,0,0,50.13.2V2.744Z");
    			attr_dev(path13, "transform", "translate(-36.139 -0.173)");
    			add_location(path13, file$b, 6, 1921, 2034);
    			attr_dev(path14, "class", "b");
    			attr_dev(path14, "d", "M50.13,11.83H60.923A14.053,14.053,0,0,0,58.177,9.3H50.13Z");
    			attr_dev(path14, "transform", "translate(-36.139 -6.716)");
    			add_location(path14, file$b, 6, 2029, 2142);
    			attr_dev(path15, "class", "b");
    			attr_dev(path15, "d", "M29.547,2.744V.2A13.932,13.932,0,0,0,21.5,2.744");
    			attr_dev(path15, "transform", "translate(-15.556 -0.173)");
    			add_location(path15, file$b, 6, 2146, 2259);
    			attr_dev(line1, "class", "b");
    			attr_dev(line1, "y1", "2.544");
    			attr_dev(line1, "transform", "translate(13.991 5.114)");
    			add_location(line1, file$b, 6, 2253, 2366);
    			attr_dev(path16, "class", "b");
    			attr_dev(path16, "d", "M7.452,18.3A13.85,13.85,0,0,0,5.78,20.844");
    			attr_dev(path16, "transform", "translate(-4.254 -13.186)");
    			add_location(path16, file$b, 6, 2317, 2430);
    			attr_dev(path17, "class", "c");
    			attr_dev(path17, "d", "M14.372.16S7.8-.458,2.939,6.085a14.049,14.049,0,0,0-2.5,9.34H14.372Z");
    			attr_dev(path17, "transform", "translate(-0.381 -0.134)");
    			add_location(path17, file$b, 6, 2418, 2531);
    			attr_dev(path18, "class", "d");
    			attr_dev(path18, "d", "M14.365,15.424H.425A14.823,14.823,0,0,1,.63,11.556a14.559,14.559,0,0,1,.883-2.945,13.429,13.429,0,0,1,.961-1.875c.267-.424.453-.655.453-.658A15.458,15.458,0,0,1,6.765,2.4,13.657,13.657,0,0,1,10.47.662a13.032,13.032,0,0,1,2.791-.5,7.67,7.67,0,0,1,1.1,0h0Zm-13.935,0H14.359V.159a7.926,7.926,0,0,0-1.1,0,13.061,13.061,0,0,0-2.791.5A14.6,14.6,0,0,0,2.932,6.084a6.718,6.718,0,0,0-.453.655,13.429,13.429,0,0,0-.961,1.875,14.733,14.733,0,0,0-1.088,6.8Z");
    			attr_dev(path18, "transform", "translate(-0.371 -0.13)");
    			add_location(path18, file$b, 6, 2545, 2658);
    			attr_dev(path19, "class", "b");
    			attr_dev(path19, "d", "M41.708,4.45l.3.6.66.1-.478.469.112.658-.593-.312-.59.312.112-.658-.481-.469.663-.1Z");
    			attr_dev(path19, "transform", "translate(-29.297 -3.192)");
    			add_location(path19, file$b, 6, 3048, 3161);
    			attr_dev(path20, "class", "b");
    			attr_dev(path20, "d", "M31.538,7.69l.3.6.663.1-.481.467.112.658-.59-.309-.593.309.112-.658-.478-.467.663-.1Z");
    			attr_dev(path20, "transform", "translate(-21.985 -5.522)");
    			add_location(path20, file$b, 6, 3192, 3305);
    			attr_dev(path21, "class", "b");
    			attr_dev(path21, "d", "M21.748,11.68l.3.6.66.1-.478.467.112.66-.59-.312-.593.312.112-.66-.478-.467.66-.1Z");
    			attr_dev(path21, "transform", "translate(-14.947 -8.39)");
    			add_location(path21, file$b, 6, 3337, 3450);
    			attr_dev(path22, "class", "b");
    			attr_dev(path22, "d", "M13.9,16.21l.3.6.663.1-.481.469.112.658-.59-.312-.593.312.112-.658L12.94,16.9l.66-.1Z");
    			attr_dev(path22, "transform", "translate(-9.303 -11.647)");
    			add_location(path22, file$b, 6, 3478, 3591);
    			attr_dev(path23, "class", "b");
    			attr_dev(path23, "d", "M13.9,25.26l.3.6.663.1-.481.469.112.658-.59-.309-.593.309.112-.658-.478-.469.66-.1Z");
    			attr_dev(path23, "transform", "translate(-9.303 -18.154)");
    			add_location(path23, file$b, 6, 3623, 3736);
    			attr_dev(path24, "class", "b");
    			attr_dev(path24, "d", "M6.388,28.5l.3.6.663.1-.481.467.112.658-.59-.309-.593.309.112-.658L5.43,29.2l.66-.1Z");
    			attr_dev(path24, "transform", "translate(-3.904 -20.483)");
    			add_location(path24, file$b, 6, 3766, 3879);
    			attr_dev(path25, "class", "b");
    			attr_dev(path25, "d", "M6.388,38.91l.3.6.663.1-.481.467.112.66-.59-.312-.593.312.112-.66L5.43,39.6l.66-.1Z");
    			attr_dev(path25, "transform", "translate(-3.904 -27.967)");
    			add_location(path25, file$b, 6, 3910, 4023);
    			attr_dev(path26, "class", "b");
    			attr_dev(path26, "d", "M13.9,34.31l.3.6.663.1-.481.467.112.658-.59-.309-.593.309.112-.658-.478-.467.66-.1Z");
    			attr_dev(path26, "transform", "translate(-9.303 -24.66)");
    			add_location(path26, file$b, 6, 4053, 4166);
    			attr_dev(path27, "class", "b");
    			attr_dev(path27, "d", "M13.9,43.36l.3.6.663.1-.481.467.112.658-.59-.309-.593.309.112-.658-.478-.467.66-.1Z");
    			attr_dev(path27, "transform", "translate(-9.303 -31.167)");
    			add_location(path27, file$b, 6, 4195, 4308);
    			attr_dev(path28, "class", "b");
    			attr_dev(path28, "d", "M21.748,20.73l.3.6.66.1-.478.467.112.66-.59-.312-.593.312.112-.66-.478-.467.66-.1Z");
    			attr_dev(path28, "transform", "translate(-14.947 -14.897)");
    			add_location(path28, file$b, 6, 4338, 4451);
    			attr_dev(path29, "class", "b");
    			attr_dev(path29, "d", "M21.748,30.89l.3.6.66.1-.478.467.112.658-.59-.309-.593.309.112-.658-.478-.467.66-.1Z");
    			attr_dev(path29, "transform", "translate(-14.947 -22.201)");
    			add_location(path29, file$b, 6, 4481, 4594);
    			attr_dev(path30, "class", "b");
    			attr_dev(path30, "d", "M21.748,41.04l.3.6.66.1-.478.467.112.66-.59-.312-.593.312.112-.66-.478-.467.66-.1Z");
    			attr_dev(path30, "transform", "translate(-14.947 -29.499)");
    			add_location(path30, file$b, 6, 4626, 4739);
    			attr_dev(path31, "class", "b");
    			attr_dev(path31, "d", "M31.538,17.11l.3.6.663.1-.481.467.112.66-.59-.312-.593.312.112-.66-.478-.467.663-.1Z");
    			attr_dev(path31, "transform", "translate(-21.985 -12.294)");
    			add_location(path31, file$b, 6, 4769, 4882);
    			attr_dev(path32, "class", "b");
    			attr_dev(path32, "d", "M31.538,26.54l.3.6.663.1-.481.467.112.658-.59-.309-.593.309.112-.658-.478-.467.663-.1Z");
    			attr_dev(path32, "transform", "translate(-21.985 -19.074)");
    			add_location(path32, file$b, 6, 4914, 5027);
    			attr_dev(path33, "class", "b");
    			attr_dev(path33, "d", "M31.538,35.96l.3.6.663.1-.481.467.112.66-.59-.312-.593.312.112-.66-.478-.467.663-.1Z");
    			attr_dev(path33, "transform", "translate(-21.985 -25.846)");
    			add_location(path33, file$b, 6, 5061, 5174);
    			attr_dev(path34, "class", "b");
    			attr_dev(path34, "d", "M31.538,45.39l.3.6.663.1-.481.467.112.658-.59-.309-.593.309.112-.658-.478-.467.663-.1Z");
    			attr_dev(path34, "transform", "translate(-21.985 -32.626)");
    			add_location(path34, file$b, 6, 5206, 5319);
    			attr_dev(path35, "class", "b");
    			attr_dev(path35, "d", "M41.708,13.87l.3.6.66.1-.478.467.112.66-.593-.312-.59.312.112-.66-.481-.467.663-.1Z");
    			attr_dev(path35, "transform", "translate(-29.297 -9.965)");
    			add_location(path35, file$b, 6, 5353, 5466);
    			attr_dev(path36, "class", "b");
    			attr_dev(path36, "d", "M41.708,23.3l.3.6.66.1-.478.467.112.66-.593-.312-.59.312.112-.66-.481-.467.663-.1Z");
    			attr_dev(path36, "transform", "translate(-29.297 -16.745)");
    			add_location(path36, file$b, 6, 5496, 5609);
    			attr_dev(path37, "class", "b");
    			attr_dev(path37, "d", "M41.708,32.72l.3.6.66.1-.478.467.112.66-.593-.312-.59.312.112-.66-.481-.467.663-.1Z");
    			attr_dev(path37, "transform", "translate(-29.297 -23.517)");
    			add_location(path37, file$b, 6, 5639, 5752);
    			attr_dev(path38, "class", "b");
    			attr_dev(path38, "d", "M41.708,42.15l.3.6.66.1-.478.467.112.66-.593-.312-.59.312.112-.66-.481-.467.663-.1Z");
    			attr_dev(path38, "transform", "translate(-29.297 -30.297)");
    			add_location(path38, file$b, 6, 5783, 5896);
    			attr_dev(g, "transform", "translate(0 -0.01)");
    			add_location(g, file$b, 6, 211, 324);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 27.982 27.999");
    			add_location(svg, file$b, 6, 0, 113);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, defs);
    			append_hydration_dev(defs, style);
    			append_hydration_dev(style, t);
    			append_hydration_dev(svg, g);
    			append_hydration_dev(g, path0);
    			append_hydration_dev(g, path1);
    			append_hydration_dev(g, path2);
    			append_hydration_dev(g, path3);
    			append_hydration_dev(g, path4);
    			append_hydration_dev(g, path5);
    			append_hydration_dev(g, path6);
    			append_hydration_dev(g, path7);
    			append_hydration_dev(g, line0);
    			append_hydration_dev(g, path8);
    			append_hydration_dev(g, path9);
    			append_hydration_dev(g, path10);
    			append_hydration_dev(g, path11);
    			append_hydration_dev(g, path12);
    			append_hydration_dev(g, path13);
    			append_hydration_dev(g, path14);
    			append_hydration_dev(g, path15);
    			append_hydration_dev(g, line1);
    			append_hydration_dev(g, path16);
    			append_hydration_dev(g, path17);
    			append_hydration_dev(g, path18);
    			append_hydration_dev(g, path19);
    			append_hydration_dev(g, path20);
    			append_hydration_dev(g, path21);
    			append_hydration_dev(g, path22);
    			append_hydration_dev(g, path23);
    			append_hydration_dev(g, path24);
    			append_hydration_dev(g, path25);
    			append_hydration_dev(g, path26);
    			append_hydration_dev(g, path27);
    			append_hydration_dev(g, path28);
    			append_hydration_dev(g, path29);
    			append_hydration_dev(g, path30);
    			append_hydration_dev(g, path31);
    			append_hydration_dev(g, path32);
    			append_hydration_dev(g, path33);
    			append_hydration_dev(g, path34);
    			append_hydration_dev(g, path35);
    			append_hydration_dev(g, path36);
    			append_hydration_dev(g, path37);
    			append_hydration_dev(g, path38);
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
    		id: create_fragment$b.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$b($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Flag_america_thumbnail', slots, []);
    	let { width = "27.982", height = "27.999", size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Flag_america_thumbnail> was created with unknown prop '${key}'`);
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

    class Flag_america_thumbnail extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$b, create_fragment$b, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Flag_america_thumbnail",
    			options,
    			id: create_fragment$b.name
    		});
    	}

    	get width() {
    		throw new Error("<Flag_america_thumbnail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Flag_america_thumbnail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Flag_america_thumbnail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Flag_america_thumbnail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Flag_america_thumbnail>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Flag_america_thumbnail>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\mobile-app-icon.svelte generated by Svelte v3.44.1 */

    const file$a = "node_modules\\ashcomm-core-svelte\\SVG\\mobile-app-icon.svelte";

    function create_fragment$a(ctx) {
    	let svg;
    	let defs;
    	let style;
    	let t;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let circle;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			defs = svg_element("defs");
    			style = svg_element("style");
    			t = text(".b23fe92c-79d4-4b94-91e6-55438f63edf6{fill:#333;}");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			circle = svg_element("circle");
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
    			t = claim_text(style_nodes, ".b23fe92c-79d4-4b94-91e6-55438f63edf6{fill:#333;}");
    			style_nodes.forEach(detach_dev);
    			defs_nodes.forEach(detach_dev);
    			path0 = claim_svg_element(svg_nodes, "path", { class: true, d: true, transform: true });
    			children(path0).forEach(detach_dev);
    			path1 = claim_svg_element(svg_nodes, "path", { class: true, d: true, transform: true });
    			children(path1).forEach(detach_dev);
    			path2 = claim_svg_element(svg_nodes, "path", { class: true, d: true, transform: true });
    			children(path2).forEach(detach_dev);
    			path3 = claim_svg_element(svg_nodes, "path", { class: true, d: true, transform: true });
    			children(path3).forEach(detach_dev);
    			circle = claim_svg_element(svg_nodes, "circle", { class: true, cx: true, cy: true, r: true });
    			children(circle).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			add_location(style, file$a, 6, 184, 299);
    			add_location(defs, file$a, 6, 178, 293);
    			attr_dev(path0, "class", "b23fe92c-79d4-4b94-91e6-55438f63edf6");
    			attr_dev(path0, "d", "M2.4,19.18H8.79a2.39,2.39,0,0,0,2.4-2.4h0V2.4A2.41,2.41,0,0,0,8.79,0H2.4A2.4,2.4,0,0,0,0,2.4V16.78a2.39,2.39,0,0,0,2.38,2.4ZM8.79.81a1.6,1.6,0,0,1,1.6,1.6h0V16.78a1.6,1.6,0,0,1-1.6,1.6H2.4A1.59,1.59,0,0,1,.8,16.8v0h0V2.4A1.6,1.6,0,0,1,2.4.8H8.79Z");
    			attr_dev(path0, "transform", "translate(0 -0.01)");
    			add_location(path0, file$a, 6, 255, 370);
    			attr_dev(path1, "class", "b23fe92c-79d4-4b94-91e6-55438f63edf6");
    			attr_dev(path1, "d", "M.4,4H10.79a.4.4,0,0,0,0-.8H.4A.4.4,0,0,0,.4,4Z");
    			attr_dev(path1, "transform", "translate(0 -0.01)");
    			add_location(path1, file$a, 6, 589, 704);
    			attr_dev(path2, "class", "b23fe92c-79d4-4b94-91e6-55438f63edf6");
    			attr_dev(path2, "d", "M.4,16H10.79a.4.4,0,1,0,0-.8H.4a.4.4,0,0,0,0,.8Z");
    			attr_dev(path2, "transform", "translate(0 -0.01)");
    			add_location(path2, file$a, 6, 724, 839);
    			attr_dev(path3, "class", "b23fe92c-79d4-4b94-91e6-55438f63edf6");
    			attr_dev(path3, "d", "M4.39,2.41h2.4a.4.4,0,0,0,0-.8H4.39a.4.4,0,0,0,0,.8Z");
    			attr_dev(path3, "transform", "translate(0 -0.01)");
    			add_location(path3, file$a, 6, 860, 975);
    			attr_dev(circle, "class", "b23fe92c-79d4-4b94-91e6-55438f63edf6");
    			attr_dev(circle, "cx", "5.6");
    			attr_dev(circle, "cy", "17.17");
    			attr_dev(circle, "r", "0.8");
    			add_location(circle, file$a, 6, 1000, 1115);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "id", "b47d0c76-8e4c-4971-b532-29d0c1ce781a");
    			attr_dev(svg, "data-name", "Layer 1");
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 11.19 19.17");
    			add_location(svg, file$a, 6, 0, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, defs);
    			append_hydration_dev(defs, style);
    			append_hydration_dev(style, t);
    			append_hydration_dev(svg, path0);
    			append_hydration_dev(svg, path1);
    			append_hydration_dev(svg, path2);
    			append_hydration_dev(svg, path3);
    			append_hydration_dev(svg, circle);
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
    		id: create_fragment$a.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$a($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Mobile_app_icon', slots, []);
    	let { width = undefined, height = undefined, size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Mobile_app_icon> was created with unknown prop '${key}'`);
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

    class Mobile_app_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$a, create_fragment$a, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Mobile_app_icon",
    			options,
    			id: create_fragment$a.name
    		});
    	}

    	get width() {
    		throw new Error("<Mobile_app_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Mobile_app_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Mobile_app_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Mobile_app_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Mobile_app_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Mobile_app_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\scroll-to-top.svelte generated by Svelte v3.44.1 */

    const file$9 = "node_modules\\ashcomm-core-svelte\\SVG\\scroll-to-top.svelte";

    function create_fragment$9(ctx) {
    	let svg;
    	let g1;
    	let g0;
    	let path0;
    	let path1;
    	let path2;
    	let path3;
    	let path4;
    	let path5;
    	let path6;
    	let path7;
    	let path8;
    	let path9;
    	let path10;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g1 = svg_element("g");
    			g0 = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			path2 = svg_element("path");
    			path3 = svg_element("path");
    			path4 = svg_element("path");
    			path5 = svg_element("path");
    			path6 = svg_element("path");
    			path7 = svg_element("path");
    			path8 = svg_element("path");
    			path9 = svg_element("path");
    			path10 = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			g1 = claim_svg_element(svg_nodes, "g", { id: true, "data-name": true });
    			var g1_nodes = children(g1);
    			g0 = claim_svg_element(g1_nodes, "g", { id: true });
    			var g0_nodes = children(g0);
    			path0 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path0).forEach(detach_dev);
    			path1 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path1).forEach(detach_dev);
    			path2 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path2).forEach(detach_dev);
    			path3 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path3).forEach(detach_dev);
    			path4 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path4).forEach(detach_dev);
    			path5 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path5).forEach(detach_dev);
    			path6 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path6).forEach(detach_dev);
    			path7 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path7).forEach(detach_dev);
    			path8 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path8).forEach(detach_dev);
    			path9 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path9).forEach(detach_dev);
    			path10 = claim_svg_element(g0_nodes, "path", { d: true });
    			children(path10).forEach(detach_dev);
    			g0_nodes.forEach(detach_dev);
    			g1_nodes.forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(path0, "d", "M52.78,29.57l-18-18a4,4,0,0,0-5.66,0L10.72,30a4,4,0,0,0,5.66,5.66L27.75,24.26V46.17a4,4,0,0,0,8,0V23.86L47.12,35.23a4,4,0,1,0,5.66-5.66Z");
    			add_location(path0, file$9, 6, 169, 284);
    			attr_dev(path1, "d", "M50.5,8H13a4,4,0,1,1,0-8H50.5a4,4,0,0,1,0,8Z");
    			add_location(path1, file$9, 6, 317, 432);
    			attr_dev(path2, "d", "M0,56.11H2.22a4.36,4.36,0,0,1,2.2.43,1.5,1.5,0,0,1,.68,1.38,1.71,1.71,0,0,1-.3,1,1.19,1.19,0,0,1-.79.5v0a1.58,1.58,0,0,1,1,.57,1.84,1.84,0,0,1,.3,1.1,1.8,1.8,0,0,1-.7,1.52,3,3,0,0,1-1.91.55H0Zm1.51,2.82h.88a1.59,1.59,0,0,0,.89-.19.69.69,0,0,0,.27-.62.63.63,0,0,0-.3-.59,1.88,1.88,0,0,0-.94-.18h-.8Zm0,1.2V62h1a1.47,1.47,0,0,0,.92-.24A.87.87,0,0,0,3.71,61c0-.59-.42-.89-1.26-.89Z");
    			add_location(path2, file$9, 6, 373, 488);
    			attr_dev(path3, "d", "M11.07,63.24l-.52-1.7H8l-.52,1.7H5.81l2.52-7.16h1.84l2.53,7.16Zm-.88-3c-.48-1.53-.74-2.4-.8-2.6a4.58,4.58,0,0,1-.13-.48c-.11.42-.42,1.44-.93,3.08Z");
    			add_location(path3, file$9, 6, 763, 878);
    			attr_dev(path4, "d", "M16.62,57.27a1.53,1.53,0,0,0-1.32.64,3,3,0,0,0-.47,1.78c0,1.59.6,2.39,1.79,2.39a5.69,5.69,0,0,0,1.82-.38V63a5.15,5.15,0,0,1-2,.37,3,3,0,0,1-2.38-1,4,4,0,0,1-.82-2.71,4.37,4.37,0,0,1,.4-1.94,2.89,2.89,0,0,1,1.16-1.28A3.44,3.44,0,0,1,16.62,56a4.89,4.89,0,0,1,2.09.5l-.49,1.23a6.76,6.76,0,0,0-.8-.33A2.29,2.29,0,0,0,16.62,57.27Z");
    			add_location(path4, file$9, 6, 921, 1036);
    			attr_dev(path5, "d", "M25.69,63.24H24l-1.87-3-.63.45v2.55H20V56.11h1.51v3.26l.59-.83L24,56.11h1.68l-2.49,3.16Z");
    			add_location(path5, file$9, 6, 1258, 1373);
    			attr_dev(path6, "d", "M31.93,63.24H30.42V57.37H28.48V56.11h5.38v1.26H31.93Z");
    			add_location(path6, file$9, 6, 1358, 1473);
    			attr_dev(path7, "d", "M41.43,59.66a3.93,3.93,0,0,1-.88,2.73,3.29,3.29,0,0,1-2.52,1,3.25,3.25,0,0,1-2.51-1,3.88,3.88,0,0,1-.88-2.73,3.8,3.8,0,0,1,.88-2.72A3.28,3.28,0,0,1,38,56a3.26,3.26,0,0,1,2.52,1A3.85,3.85,0,0,1,41.43,59.66Zm-5.21,0a3,3,0,0,0,.46,1.8,1.56,1.56,0,0,0,1.35.61c1.21,0,1.81-.8,1.81-2.41s-.6-2.4-1.8-2.4a1.61,1.61,0,0,0-1.36.6A3,3,0,0,0,36.22,59.66Z");
    			add_location(path7, file$9, 6, 1423, 1538);
    			attr_dev(path8, "d", "M48.24,63.24H46.73V57.37H44.8V56.11h5.38v1.26H48.24Z");
    			add_location(path8, file$9, 6, 1777, 1892);
    			attr_dev(path9, "d", "M57.75,59.66a3.93,3.93,0,0,1-.88,2.73,3.29,3.29,0,0,1-2.52,1,3.25,3.25,0,0,1-2.51-1A3.88,3.88,0,0,1,51,59.66a3.8,3.8,0,0,1,.88-2.72,3.83,3.83,0,0,1,5,0A3.85,3.85,0,0,1,57.75,59.66Zm-5.21,0a3,3,0,0,0,.46,1.8,1.56,1.56,0,0,0,1.35.61c1.21,0,1.81-.8,1.81-2.41s-.6-2.4-1.8-2.4a1.61,1.61,0,0,0-1.36.6A3,3,0,0,0,52.54,59.66Z");
    			add_location(path9, file$9, 6, 1841, 1956);
    			attr_dev(path10, "d", "M64.14,58.33a2.16,2.16,0,0,1-.72,1.76,3,3,0,0,1-2,.61h-.65v2.54H59.22V56.11H61.5a3,3,0,0,1,2,.56A2,2,0,0,1,64.14,58.33Zm-3.41,1.14h.5a1.68,1.68,0,0,0,1-.28,1,1,0,0,0,.35-.8,1,1,0,0,0-.29-.79,1.37,1.37,0,0,0-.91-.25h-.69Z");
    			add_location(path10, file$9, 6, 2170, 2285);
    			attr_dev(g0, "id", "keylines");
    			add_location(g0, file$9, 6, 152, 267);
    			attr_dev(g1, "id", "Layer_2");
    			attr_dev(g1, "data-name", "Layer 2");
    			add_location(g1, file$9, 6, 116, 231);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 64.14 63.34");
    			add_location(svg, file$9, 6, 0, 115);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, g1);
    			append_hydration_dev(g1, g0);
    			append_hydration_dev(g0, path0);
    			append_hydration_dev(g0, path1);
    			append_hydration_dev(g0, path2);
    			append_hydration_dev(g0, path3);
    			append_hydration_dev(g0, path4);
    			append_hydration_dev(g0, path5);
    			append_hydration_dev(g0, path6);
    			append_hydration_dev(g0, path7);
    			append_hydration_dev(g0, path8);
    			append_hydration_dev(g0, path9);
    			append_hydration_dev(g0, path10);
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
    		id: create_fragment$9.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$9($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Scroll_to_top', slots, []);
    	let { width = undefined, height = undefined, size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Scroll_to_top> was created with unknown prop '${key}'`);
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

    class Scroll_to_top extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$9, create_fragment$9, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Scroll_to_top",
    			options,
    			id: create_fragment$9.name
    		});
    	}

    	get width() {
    		throw new Error("<Scroll_to_top>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Scroll_to_top>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Scroll_to_top>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Scroll_to_top>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Scroll_to_top>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Scroll_to_top>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\social-facebook-icon.svelte generated by Svelte v3.44.1 */

    const file$8 = "node_modules\\ashcomm-core-svelte\\SVG\\social-facebook-icon.svelte";

    function create_fragment$8(ctx) {
    	let svg;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			path = claim_svg_element(svg_nodes, "path", { d: true, transform: true });
    			children(path).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(path, "d", "M47.7,28.012H44.272c-.42,0-.839.533-.839,1.259v2.476H47.7v3.524H43.416V45.836H39.371V35.254H35.7V31.73h3.671v-2.1c0-2.971,2.064-5.392,4.9-5.392H47.7Z");
    			attr_dev(path, "transform", "translate(-35.7 -24.24)");
    			add_location(path, file$8, 6, 114, 223);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 12 21.596");
    			add_location(svg, file$8, 6, 0, 109);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
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
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Social_facebook_icon', slots, []);
    	let { width = "12", height = "21.596", size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Social_facebook_icon> was created with unknown prop '${key}'`);
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

    class Social_facebook_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social_facebook_icon",
    			options,
    			id: create_fragment$8.name
    		});
    	}

    	get width() {
    		throw new Error("<Social_facebook_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Social_facebook_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Social_facebook_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Social_facebook_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Social_facebook_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Social_facebook_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\social-instagram-icon.svelte generated by Svelte v3.44.1 */

    const file$7 = "node_modules\\ashcomm-core-svelte\\SVG\\social-instagram-icon.svelte";

    function create_fragment$7(ctx) {
    	let svg;
    	let g;
    	let path0;
    	let path1;
    	let circle;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			g = svg_element("g");
    			path0 = svg_element("path");
    			path1 = svg_element("path");
    			circle = svg_element("circle");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			g = claim_svg_element(svg_nodes, "g", { transform: true });
    			var g_nodes = children(g);
    			path0 = claim_svg_element(g_nodes, "path", { d: true, transform: true });
    			children(path0).forEach(detach_dev);
    			path1 = claim_svg_element(g_nodes, "path", { d: true });
    			children(path1).forEach(detach_dev);

    			circle = claim_svg_element(g_nodes, "circle", {
    				cx: true,
    				cy: true,
    				r: true,
    				transform: true
    			});

    			children(circle).forEach(detach_dev);
    			g_nodes.forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(path0, "d", "M42.318,46.033A5.286,5.286,0,1,1,32.7,43H27.12v8.665A4.281,4.281,0,0,0,31.4,55.946H42.665a4.281,4.281,0,0,0,4.281-4.281V43h-5.58A5.255,5.255,0,0,1,42.318,46.033Z");
    			attr_dev(path0, "transform", "translate(0 -9)");
    			add_location(path0, file$7, 6, 158, 272);
    			attr_dev(path1, "d", "M42.665,27.12H31.4A4.281,4.281,0,0,0,27.12,31.4v1.477h6.642a5.3,5.3,0,0,1,6.542,0h6.642V31.4a4.281,4.281,0,0,0-4.281-4.281Zm1.794,4.064a.355.355,0,0,1-.351.355H42.2a.355.355,0,0,1-.351-.355V29.278a.355.355,0,0,1,.351-.355h1.911a.355.355,0,0,1,.351.355Z");
    			add_location(path1, file$7, 6, 359, 473);
    			attr_dev(circle, "cx", "4.268");
    			attr_dev(circle, "cy", "4.268");
    			attr_dev(circle, "r", "4.268");
    			attr_dev(circle, "transform", "translate(32.765 32.765)");
    			add_location(circle, file$7, 6, 623, 737);
    			attr_dev(g, "transform", "translate(-27.12 -27.12)");
    			add_location(g, file$7, 6, 118, 232);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 19.826 19.826");
    			add_location(svg, file$7, 6, 0, 114);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
    			append_hydration_dev(svg, g);
    			append_hydration_dev(g, path0);
    			append_hydration_dev(g, path1);
    			append_hydration_dev(g, circle);
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
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Social_instagram_icon', slots, []);
    	let { width = undefined, height = undefined, size = "19.826" } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Social_instagram_icon> was created with unknown prop '${key}'`);
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

    class Social_instagram_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social_instagram_icon",
    			options,
    			id: create_fragment$7.name
    		});
    	}

    	get width() {
    		throw new Error("<Social_instagram_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Social_instagram_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Social_instagram_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Social_instagram_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Social_instagram_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Social_instagram_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\social-pinterest-icon.svelte generated by Svelte v3.44.1 */

    const file$6 = "node_modules\\ashcomm-core-svelte\\SVG\\social-pinterest-icon.svelte";

    function create_fragment$6(ctx) {
    	let svg;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			path = claim_svg_element(svg_nodes, "path", { d: true, transform: true });
    			children(path).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(path, "d", "M28.787,29.867c.139-3.951,3.547-6.718,6.963-7.1,4.32-.486,8.377,1.587,8.935,5.655.633,4.6-1.949,9.564-6.567,9.206-1.252-.1-1.779-.716-2.76-1.312-.543,2.831-1.218,5.553-3.155,6.967-.6-4.283.886-7.5,1.561-10.914-1.176-1.987.143-5.983,2.639-5,3.057,1.214-2.639,7.381,1.18,8.158,4,.8,5.636-6.952,3.155-9.47-3.581-3.623-10.427-.087-9.587,5.127.207,1.274,1.508,1.663.524,3.419C29.383,34.093,28.7,32.284,28.787,29.867Z");
    			attr_dev(path, "transform", "translate(-28.779 -22.695)");
    			add_location(path, file$6, 6, 114, 223);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 16 20.585");
    			add_location(svg, file$6, 6, 0, 109);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
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
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Social_pinterest_icon', slots, []);
    	let { width = "16", height = "20.585", size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Social_pinterest_icon> was created with unknown prop '${key}'`);
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

    class Social_pinterest_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social_pinterest_icon",
    			options,
    			id: create_fragment$6.name
    		});
    	}

    	get width() {
    		throw new Error("<Social_pinterest_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Social_pinterest_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Social_pinterest_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Social_pinterest_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Social_pinterest_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Social_pinterest_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\social-twitter-icon.svelte generated by Svelte v3.44.1 */

    const file$5 = "node_modules\\ashcomm-core-svelte\\SVG\\social-twitter-icon.svelte";

    function create_fragment$5(ctx) {
    	let svg;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			path = claim_svg_element(svg_nodes, "path", { d: true, transform: true });
    			children(path).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(path, "d", "M44.758,33.342v.626A13.8,13.8,0,0,1,23.52,45.58a9.841,9.841,0,0,0,7.157-2,4.862,4.862,0,0,1-4.531-3.368,4.746,4.746,0,0,0,.895.085,4.822,4.822,0,0,0,1.279-.166,4.853,4.853,0,0,1-3.891-4.75.273.273,0,0,1,0-.063,4.853,4.853,0,0,0,2.263.608,4.84,4.84,0,0,1-2.16-4.026,4.773,4.773,0,0,1,.658-2.433,13.781,13.781,0,0,0,10,5.05,4.737,4.737,0,0,1-.13-1.109,4.853,4.853,0,0,1,8.391-3.3,9.63,9.63,0,0,0,3.1-1.194A4.853,4.853,0,0,1,44.413,31.6a9.841,9.841,0,0,0,2.787-.76,9.841,9.841,0,0,1-2.442,2.5");
    			attr_dev(path, "transform", "translate(-23.52 -28.576)");
    			add_location(path, file$5, 6, 117, 229);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 23.68 19.182");
    			add_location(svg, file$5, 6, 0, 112);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
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
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Social_twitter_icon', slots, []);
    	let { width = "23.68", height = "19.182", size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Social_twitter_icon> was created with unknown prop '${key}'`);
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

    class Social_twitter_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social_twitter_icon",
    			options,
    			id: create_fragment$5.name
    		});
    	}

    	get width() {
    		throw new Error("<Social_twitter_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Social_twitter_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Social_twitter_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Social_twitter_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Social_twitter_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Social_twitter_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\SVG\social-youtube-icon.svelte generated by Svelte v3.44.1 */

    const file$4 = "node_modules\\ashcomm-core-svelte\\SVG\\social-youtube-icon.svelte";

    function create_fragment$4(ctx) {
    	let svg;
    	let path;
    	let svg_width_value;
    	let svg_height_value;

    	const block = {
    		c: function create() {
    			svg = svg_element("svg");
    			path = svg_element("path");
    			this.h();
    		},
    		l: function claim(nodes) {
    			svg = claim_svg_element(nodes, "svg", {
    				width: true,
    				height: true,
    				xmlns: true,
    				viewBox: true
    			});

    			var svg_nodes = children(svg);
    			path = claim_svg_element(svg_nodes, "path", { d: true, transform: true });
    			children(path).forEach(detach_dev);
    			svg_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(path, "d", "M49.671,36.1a5.418,5.418,0,0,0-.995-2.487,3.547,3.547,0,0,0-2.487-1.059c-3.482-.254-8.754-.254-8.754-.254h0s-5.253,0-8.754.254a3.547,3.547,0,0,0-2.487,1.059A5.4,5.4,0,0,0,25.2,36.1a38.056,38.056,0,0,0-.249,4.049v1.9A38.056,38.056,0,0,0,25.2,46.1a5.418,5.418,0,0,0,.995,2.487,4.253,4.253,0,0,0,2.761,1.069c1.99.189,8.506.249,8.506.249s5.258,0,8.759-.259a3.591,3.591,0,0,0,2.487-1.059A5.418,5.418,0,0,0,49.7,46.1a38.057,38.057,0,0,0,.249-4.049v-1.9A38.058,38.058,0,0,0,49.671,36.1ZM37.41,42.82,34.2,44.531V37.677l3.208,1.711L40.619,41.1Z");
    			attr_dev(path, "transform", "translate(-24.95 -32.3)");
    			add_location(path, file$4, 6, 114, 223);
    			attr_dev(svg, "width", svg_width_value = /*size*/ ctx[2] || /*width*/ ctx[0]);
    			attr_dev(svg, "height", svg_height_value = /*size*/ ctx[2] || /*height*/ ctx[1]);
    			attr_dev(svg, "xmlns", "http://www.w3.org/2000/svg");
    			attr_dev(svg, "viewBox", "0 0 25 17.603");
    			add_location(svg, file$4, 6, 0, 109);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, svg, anchor);
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
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Social_youtube_icon', slots, []);
    	let { width = "25", height = "17.603", size = undefined } = $$props;
    	const writable_props = ['width', 'height', 'size'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Social_youtube_icon> was created with unknown prop '${key}'`);
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

    class Social_youtube_icon extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, not_equal, { width: 0, height: 1, size: 2 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Social_youtube_icon",
    			options,
    			id: create_fragment$4.name
    		});
    	}

    	get width() {
    		throw new Error("<Social_youtube_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set width(value) {
    		throw new Error("<Social_youtube_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get height() {
    		throw new Error("<Social_youtube_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set height(value) {
    		throw new Error("<Social_youtube_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get size() {
    		throw new Error("<Social_youtube_icon>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set size(value) {
    		throw new Error("<Social_youtube_icon>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* node_modules\ashcomm-core-svelte\Input\Input.svelte generated by Svelte v3.44.1 */

    const file$3 = "node_modules\\ashcomm-core-svelte\\Input\\Input.svelte";

    function create_fragment$3(ctx) {
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
    			add_location(input, file$3, 35, 0, 950);
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
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
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

    		init(this, options, instance$3, create_fragment$3, not_equal, {
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
    			id: create_fragment$3.name
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

    const file$2 = "node_modules\\ashcomm-core-svelte\\Button\\Button.svelte";

    function create_fragment$2(ctx) {
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
    			add_location(button, file$2, 13, 0, 217);
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
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
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

    		init(this, options, instance$2, create_fragment$2, not_equal, {
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
    			id: create_fragment$2.name
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

    const subscriber_queue = [];
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
    function hasLocaleDictionary(locale) {
        return locale in dictionary;
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

    /* node_modules\ashcomm-core-svelte\List\ListItem.svelte generated by Svelte v3.44.1 */

    const file$1 = "node_modules\\ashcomm-core-svelte\\List\\ListItem.svelte";

    function create_fragment$1(ctx) {
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
    			add_location(li, file$1, 8, 0, 153);
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
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
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
    		init(this, options, instance$1, create_fragment$1, not_equal, { id: 0, style: 1, horizontal: 2, class: 3 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ListItem",
    			options,
    			id: create_fragment$1.name
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

    const navStore = writable(true);

    /* src\Footer.svelte generated by Svelte v3.44.1 */
    const file = "src\\Footer.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    function get_each_context_1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[9] = list[i];
    	return child_ctx;
    }

    function get_each_context_2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[6] = list[i];
    	return child_ctx;
    }

    // (260:12) <Button                  type="submit"                  name="home-email"                  value="Sign Up"                  class="email-alert-button button tertiary-alt"                  on:click={emailAlertSignup}>
    function create_default_slot_7(ctx) {
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
    		id: create_default_slot_7.name,
    		type: "slot",
    		source: "(260:12) <Button                  type=\\\"submit\\\"                  name=\\\"home-email\\\"                  value=\\\"Sign Up\\\"                  class=\\\"email-alert-button button tertiary-alt\\\"                  on:click={emailAlertSignup}>",
    		ctx
    	});

    	return block;
    }

    // (273:45) 
    function create_if_block_1(ctx) {
    	let div;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t = text("footer.email");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			t = claim_text(div_nodes, "footer.email");
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div, "class", "fieldErrMsg svelte-6oiabe");
    			add_location(div, file, 274, 12, 10727);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, t);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(273:45) ",
    		ctx
    	});

    	return block;
    }

    // (268:8) {#if showEmailSuccess}
    function create_if_block(ctx) {
    	let div;
    	let span;
    	let t;

    	const block = {
    		c: function create() {
    			div = element("div");
    			span = element("span");
    			t = text("footer.congrats");
    			this.h();
    		},
    		l: function claim(nodes) {
    			div = claim_element(nodes, "DIV", { class: true });
    			var div_nodes = children(div);
    			span = claim_element(div_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t = claim_text(span_nodes, "footer.congrats");
    			span_nodes.forEach(detach_dev);
    			div_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(span, "class", "svelte-6oiabe");
    			add_location(span, file, 270, 16, 10546);
    			attr_dev(div, "class", "emailsignup_success svelte-6oiabe");
    			add_location(div, file, 268, 12, 10434);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div, anchor);
    			append_hydration_dev(div, span);
    			append_hydration_dev(span, t);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(268:8) {#if showEmailSuccess}",
    		ctx
    	});

    	return block;
    }

    // (281:16) <ListItem>
    function create_default_slot_6(ctx) {
    	let a;
    	let socialinstagramicon;
    	let current;
    	socialinstagramicon = new Social_instagram_icon({ $$inline: true });

    	const block = {
    		c: function create() {
    			a = element("a");
    			create_component(socialinstagramicon.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				"aria-label": true,
    				href: true,
    				target: true,
    				title: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			claim_component(socialinstagramicon.$$.fragment, a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "aria-label", "Instagram");
    			attr_dev(a, "href", "https://www.instagram.com/Ashleyhomestore/");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "title", "Instagram");
    			attr_dev(a, "class", "svelte-6oiabe");
    			add_location(a, file, 281, 20, 10949);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			mount_component(socialinstagramicon, a, null);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(socialinstagramicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(socialinstagramicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			destroy_component(socialinstagramicon);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_6.name,
    		type: "slot",
    		source: "(281:16) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (289:16) <ListItem>
    function create_default_slot_5(ctx) {
    	let a;
    	let socialfacebookicon;
    	let current;
    	socialfacebookicon = new Social_facebook_icon({ $$inline: true });

    	const block = {
    		c: function create() {
    			a = element("a");
    			create_component(socialfacebookicon.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				"aria-label": true,
    				href: true,
    				target: true,
    				title: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			claim_component(socialfacebookicon.$$.fragment, a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "aria-label", "Facebook");
    			attr_dev(a, "href", "https://www.facebook.com/AshleyHomeStore/");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "title", "Facebook");
    			attr_dev(a, "class", "svelte-6oiabe");
    			add_location(a, file, 289, 20, 11287);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			mount_component(socialfacebookicon, a, null);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(socialfacebookicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(socialfacebookicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			destroy_component(socialfacebookicon);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_5.name,
    		type: "slot",
    		source: "(289:16) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (297:16) <ListItem>
    function create_default_slot_4(ctx) {
    	let a;
    	let socialpinteresticon;
    	let current;
    	socialpinteresticon = new Social_pinterest_icon({ $$inline: true });

    	const block = {
    		c: function create() {
    			a = element("a");
    			create_component(socialpinteresticon.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				"aria-label": true,
    				href: true,
    				target: true,
    				title: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			claim_component(socialpinteresticon.$$.fragment, a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "aria-label", "Pinterest");
    			attr_dev(a, "href", "https://www.pinterest.com/ashleyhomestore/");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "title", "Pinterest");
    			attr_dev(a, "class", "svelte-6oiabe");
    			add_location(a, file, 297, 20, 11621);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			mount_component(socialpinteresticon, a, null);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(socialpinteresticon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(socialpinteresticon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			destroy_component(socialpinteresticon);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_4.name,
    		type: "slot",
    		source: "(297:16) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (305:16) <ListItem>
    function create_default_slot_3(ctx) {
    	let a;
    	let socialtwittericon;
    	let current;
    	socialtwittericon = new Social_twitter_icon({ $$inline: true });

    	const block = {
    		c: function create() {
    			a = element("a");
    			create_component(socialtwittericon.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				"aria-label": true,
    				href: true,
    				target: true,
    				title: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			claim_component(socialtwittericon.$$.fragment, a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "aria-label", "Twitter");
    			attr_dev(a, "href", "https://twitter.com/ashleyhomestore");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "title", "Twitter");
    			attr_dev(a, "class", "svelte-6oiabe");
    			add_location(a, file, 305, 20, 11959);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			mount_component(socialtwittericon, a, null);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(socialtwittericon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(socialtwittericon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			destroy_component(socialtwittericon);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_3.name,
    		type: "slot",
    		source: "(305:16) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (310:16) <ListItem>
    function create_default_slot_2(ctx) {
    	let a;
    	let socialyoutubeicon;
    	let current;
    	socialyoutubeicon = new Social_youtube_icon({ $$inline: true });

    	const block = {
    		c: function create() {
    			a = element("a");
    			create_component(socialyoutubeicon.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				"aria-label": true,
    				href: true,
    				target: true,
    				title: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			claim_component(socialyoutubeicon.$$.fragment, a_nodes);
    			a_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "aria-label", "YouTube");
    			attr_dev(a, "href", "https://www.youtube.com/user/ashleyhomestore");
    			attr_dev(a, "target", "_blank");
    			attr_dev(a, "title", "YouTube");
    			attr_dev(a, "class", "svelte-6oiabe");
    			add_location(a, file, 310, 20, 12210);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			mount_component(socialyoutubeicon, a, null);
    			current = true;
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(socialyoutubeicon.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(socialyoutubeicon.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			destroy_component(socialyoutubeicon);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_2.name,
    		type: "slot",
    		source: "(310:16) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (338:28) <ListItem>
    function create_default_slot_1(ctx) {
    	let a;
    	let t0_value = /*link*/ ctx[6].name + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", {
    				href: true,
    				target: true,
    				rel: true,
    				class: true
    			});

    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, t0_value);
    			a_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", /*link*/ ctx[6].url);
    			attr_dev(a, "target", /*link*/ ctx[6].target);
    			attr_dev(a, "rel", /*link*/ ctx[6].rel);
    			attr_dev(a, "class", "svelte-6oiabe");
    			add_location(a, file, 338, 32, 13298);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, t0);
    			insert_hydration_dev(target, t1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot_1.name,
    		type: "slot",
    		source: "(338:28) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (337:24) {#each section.links as link}
    function create_each_block_2(ctx) {
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

    			if (dirty & /*$$scope*/ 16384) {
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
    		id: create_each_block_2.name,
    		type: "each",
    		source: "(337:24) {#each section.links as link}",
    		ctx
    	});

    	return block;
    }

    // (332:8) {#each footerLinkLists as section}
    function create_each_block_1(ctx) {
    	let div1;
    	let div0;
    	let h4;
    	let t0_value = /*section*/ ctx[9].name + "";
    	let t0;
    	let t1;
    	let ul;
    	let t2;
    	let current;
    	let each_value_2 = /*section*/ ctx[9].links;
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
    			div1 = element("div");
    			div0 = element("div");
    			h4 = element("h4");
    			t0 = text(t0_value);
    			t1 = space();
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t2 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			div1 = claim_element(nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { class: true });
    			var div0_nodes = children(div0);
    			h4 = claim_element(div0_nodes, "H4", { class: true });
    			var h4_nodes = children(h4);
    			t0 = claim_text(h4_nodes, t0_value);
    			h4_nodes.forEach(detach_dev);
    			t1 = claim_space(div0_nodes);
    			ul = claim_element(div0_nodes, "UL", { class: true });
    			var ul_nodes = children(ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ul_nodes);
    			}

    			ul_nodes.forEach(detach_dev);
    			div0_nodes.forEach(detach_dev);
    			t2 = claim_space(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(h4, "class", "svelte-6oiabe");
    			add_location(h4, file, 334, 20, 13120);
    			attr_dev(ul, "class", "svelte-6oiabe");
    			add_location(ul, file, 335, 20, 13165);
    			attr_dev(div0, "class", "content-asset ca-online-only svelte-6oiabe");
    			add_location(div0, file, 333, 16, 13056);
    			attr_dev(div1, "class", "link-list " + /*section*/ ctx[9].class + " svelte-6oiabe");
    			add_location(div1, file, 332, 12, 12999);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div1, anchor);
    			append_hydration_dev(div1, div0);
    			append_hydration_dev(div0, h4);
    			append_hydration_dev(h4, t0);
    			append_hydration_dev(div0, t1);
    			append_hydration_dev(div0, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			append_hydration_dev(div1, t2);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*footerLinkLists*/ 8) {
    				each_value_2 = /*section*/ ctx[9].links;
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
    						each_blocks[i].m(ul, null);
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
    			if (detaching) detach_dev(div1);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block_1.name,
    		type: "each",
    		source: "(332:8) {#each footerLinkLists as section}",
    		ctx
    	});

    	return block;
    }

    // (362:20) <ListItem>
    function create_default_slot(ctx) {
    	let a;
    	let t0_value = /*link*/ ctx[6].name + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			a = element("a");
    			t0 = text(t0_value);
    			t1 = space();
    			this.h();
    		},
    		l: function claim(nodes) {
    			a = claim_element(nodes, "A", { href: true, target: true, class: true });
    			var a_nodes = children(a);
    			t0 = claim_text(a_nodes, t0_value);
    			a_nodes.forEach(detach_dev);
    			t1 = claim_space(nodes);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(a, "href", /*link*/ ctx[6].url);
    			attr_dev(a, "target", /*link*/ ctx[6].target);
    			attr_dev(a, "class", "svelte-6oiabe");
    			add_location(a, file, 362, 24, 14205);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, a, anchor);
    			append_hydration_dev(a, t0);
    			insert_hydration_dev(target, t1, anchor);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(a);
    			if (detaching) detach_dev(t1);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(362:20) <ListItem>",
    		ctx
    	});

    	return block;
    }

    // (361:16) {#each termsPolicies.links as link}
    function create_each_block(ctx) {
    	let listitem;
    	let current;

    	listitem = new ListItem({
    			props: {
    				$$slots: { default: [create_default_slot] },
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

    			if (dirty & /*$$scope*/ 16384) {
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
    		source: "(361:16) {#each termsPolicies.links as link}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let div15;
    	let div1;
    	let div0;
    	let input;
    	let updating_value;
    	let t0;
    	let button;
    	let t1;
    	let t2;
    	let div3;
    	let div2;
    	let ul0;
    	let listitem0;
    	let t3;
    	let listitem1;
    	let t4;
    	let listitem2;
    	let t5;
    	let listitem3;
    	let t6;
    	let listitem4;
    	let t7;
    	let div5;
    	let div4;
    	let a0;
    	let mobileappicon;
    	let t8;
    	let t9;
    	let div6;
    	let t10;
    	let div7;
    	let t11;
    	let div9;
    	let div8;
    	let a1;
    	let flagamericathumbnail;
    	let t12;
    	let span;
    	let t13;
    	let t14;
    	let div10;
    	let t15;
    	let div12;
    	let div11;
    	let h4;
    	let t16_value = /*termsPolicies*/ ctx[2].name + "";
    	let t16;
    	let t17;
    	let ul1;
    	let t18;
    	let div14;
    	let div13;
    	let scrolltotop;
    	let current;

    	function input_value_binding(value) {
    		/*input_value_binding*/ ctx[5](value);
    	}

    	let input_props = {
    		type: "text",
    		id: "email-alert-address",
    		title: "footer.enter-email",
    		class: "input-text email email-alert-address",
    		placeholder: "footer.sign-up.placeholder",
    		name: "emailsubscribe",
    		required: true
    	};

    	if (/*emailAlertAddress*/ ctx[0] !== void 0) {
    		input_props.value = /*emailAlertAddress*/ ctx[0];
    	}

    	input = new Input({ props: input_props, $$inline: true });
    	binding_callbacks.push(() => bind(input, 'value', input_value_binding));

    	button = new Button({
    			props: {
    				type: "submit",
    				name: "home-email",
    				value: "Sign Up",
    				class: "email-alert-button button tertiary-alt",
    				$$slots: { default: [create_default_slot_7] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	button.$on("click", /*emailAlertSignup*/ ctx[4]);

    	function select_block_type(ctx, dirty) {
    		if (/*showEmailSuccess*/ ctx[1]) return create_if_block;
    		if (/*showEmailSuccess*/ ctx[1] === false) return create_if_block_1;
    	}

    	let current_block_type = select_block_type(ctx);
    	let if_block = current_block_type && current_block_type(ctx);

    	listitem0 = new ListItem({
    			props: {
    				$$slots: { default: [create_default_slot_6] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	listitem1 = new ListItem({
    			props: {
    				$$slots: { default: [create_default_slot_5] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	listitem2 = new ListItem({
    			props: {
    				$$slots: { default: [create_default_slot_4] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	listitem3 = new ListItem({
    			props: {
    				$$slots: { default: [create_default_slot_3] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	listitem4 = new ListItem({
    			props: {
    				$$slots: { default: [create_default_slot_2] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	mobileappicon = new Mobile_app_icon({ $$inline: true });
    	let each_value_1 = /*footerLinkLists*/ ctx[3];
    	validate_each_argument(each_value_1);
    	let each_blocks_1 = [];

    	for (let i = 0; i < each_value_1.length; i += 1) {
    		each_blocks_1[i] = create_each_block_1(get_each_context_1(ctx, each_value_1, i));
    	}

    	const out = i => transition_out(each_blocks_1[i], 1, 1, () => {
    		each_blocks_1[i] = null;
    	});

    	flagamericathumbnail = new Flag_america_thumbnail({ $$inline: true });
    	let each_value = /*termsPolicies*/ ctx[2].links;
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const out_1 = i => transition_out(each_blocks[i], 1, 1, () => {
    		each_blocks[i] = null;
    	});

    	scrolltotop = new Scroll_to_top({ $$inline: true });

    	const block = {
    		c: function create() {
    			div15 = element("div");
    			div1 = element("div");
    			div0 = element("div");
    			create_component(input.$$.fragment);
    			t0 = space();
    			create_component(button.$$.fragment);
    			t1 = space();
    			if (if_block) if_block.c();
    			t2 = space();
    			div3 = element("div");
    			div2 = element("div");
    			ul0 = element("ul");
    			create_component(listitem0.$$.fragment);
    			t3 = space();
    			create_component(listitem1.$$.fragment);
    			t4 = space();
    			create_component(listitem2.$$.fragment);
    			t5 = space();
    			create_component(listitem3.$$.fragment);
    			t6 = space();
    			create_component(listitem4.$$.fragment);
    			t7 = space();
    			div5 = element("div");
    			div4 = element("div");
    			a0 = element("a");
    			create_component(mobileappicon.$$.fragment);
    			t8 = text("\r\n                \r\n                footer.mobile");
    			t9 = space();
    			div6 = element("div");
    			t10 = space();
    			div7 = element("div");

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].c();
    			}

    			t11 = space();
    			div9 = element("div");
    			div8 = element("div");
    			a1 = element("a");
    			create_component(flagamericathumbnail.$$.fragment);
    			t12 = space();
    			span = element("span");
    			t13 = text("footer.merica");
    			t14 = space();
    			div10 = element("div");
    			t15 = space();
    			div12 = element("div");
    			div11 = element("div");
    			h4 = element("h4");
    			t16 = text(t16_value);
    			t17 = space();
    			ul1 = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t18 = space();
    			div14 = element("div");
    			div13 = element("div");
    			create_component(scrolltotop.$$.fragment);
    			this.h();
    		},
    		l: function claim(nodes) {
    			div15 = claim_element(nodes, "DIV", { class: true });
    			var div15_nodes = children(div15);
    			div1 = claim_element(div15_nodes, "DIV", { class: true });
    			var div1_nodes = children(div1);
    			div0 = claim_element(div1_nodes, "DIV", { id: true, class: true });
    			var div0_nodes = children(div0);
    			claim_component(input.$$.fragment, div0_nodes);
    			t0 = claim_space(div0_nodes);
    			claim_component(button.$$.fragment, div0_nodes);
    			div0_nodes.forEach(detach_dev);
    			t1 = claim_space(div1_nodes);
    			if (if_block) if_block.l(div1_nodes);
    			div1_nodes.forEach(detach_dev);
    			t2 = claim_space(div15_nodes);
    			div3 = claim_element(div15_nodes, "DIV", { class: true });
    			var div3_nodes = children(div3);
    			div2 = claim_element(div3_nodes, "DIV", { class: true });
    			var div2_nodes = children(div2);
    			ul0 = claim_element(div2_nodes, "UL", { class: true });
    			var ul0_nodes = children(ul0);
    			claim_component(listitem0.$$.fragment, ul0_nodes);
    			t3 = claim_space(ul0_nodes);
    			claim_component(listitem1.$$.fragment, ul0_nodes);
    			t4 = claim_space(ul0_nodes);
    			claim_component(listitem2.$$.fragment, ul0_nodes);
    			t5 = claim_space(ul0_nodes);
    			claim_component(listitem3.$$.fragment, ul0_nodes);
    			t6 = claim_space(ul0_nodes);
    			claim_component(listitem4.$$.fragment, ul0_nodes);
    			ul0_nodes.forEach(detach_dev);
    			div2_nodes.forEach(detach_dev);
    			div3_nodes.forEach(detach_dev);
    			t7 = claim_space(div15_nodes);
    			div5 = claim_element(div15_nodes, "DIV", { class: true });
    			var div5_nodes = children(div5);
    			div4 = claim_element(div5_nodes, "DIV", { class: true });
    			var div4_nodes = children(div4);

    			a0 = claim_element(div4_nodes, "A", {
    				"aria-label": true,
    				href: true,
    				class: true
    			});

    			var a0_nodes = children(a0);
    			claim_component(mobileappicon.$$.fragment, a0_nodes);
    			t8 = claim_text(a0_nodes, "\r\n                \r\n                footer.mobile");
    			a0_nodes.forEach(detach_dev);
    			div4_nodes.forEach(detach_dev);
    			div5_nodes.forEach(detach_dev);
    			t9 = claim_space(div15_nodes);
    			div6 = claim_element(div15_nodes, "DIV", { class: true });
    			children(div6).forEach(detach_dev);
    			t10 = claim_space(div15_nodes);
    			div7 = claim_element(div15_nodes, "DIV", { class: true });
    			var div7_nodes = children(div7);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].l(div7_nodes);
    			}

    			div7_nodes.forEach(detach_dev);
    			t11 = claim_space(div15_nodes);
    			div9 = claim_element(div15_nodes, "DIV", { class: true });
    			var div9_nodes = children(div9);
    			div8 = claim_element(div9_nodes, "DIV", { class: true });
    			var div8_nodes = children(div8);
    			a1 = claim_element(div8_nodes, "A", { href: true, class: true });
    			var a1_nodes = children(a1);
    			claim_component(flagamericathumbnail.$$.fragment, a1_nodes);
    			t12 = claim_space(a1_nodes);
    			span = claim_element(a1_nodes, "SPAN", { class: true });
    			var span_nodes = children(span);
    			t13 = claim_text(span_nodes, "footer.merica");
    			span_nodes.forEach(detach_dev);
    			a1_nodes.forEach(detach_dev);
    			div8_nodes.forEach(detach_dev);
    			div9_nodes.forEach(detach_dev);
    			t14 = claim_space(div15_nodes);
    			div10 = claim_element(div15_nodes, "DIV", { class: true });
    			children(div10).forEach(detach_dev);
    			t15 = claim_space(div15_nodes);
    			div12 = claim_element(div15_nodes, "DIV", { class: true });
    			var div12_nodes = children(div12);
    			div11 = claim_element(div12_nodes, "DIV", { class: true });
    			var div11_nodes = children(div11);
    			h4 = claim_element(div11_nodes, "H4", { class: true });
    			var h4_nodes = children(h4);
    			t16 = claim_text(h4_nodes, t16_value);
    			h4_nodes.forEach(detach_dev);
    			t17 = claim_space(div11_nodes);
    			ul1 = claim_element(div11_nodes, "UL", { class: true });
    			var ul1_nodes = children(ul1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].l(ul1_nodes);
    			}

    			ul1_nodes.forEach(detach_dev);
    			div11_nodes.forEach(detach_dev);
    			div12_nodes.forEach(detach_dev);
    			t18 = claim_space(div15_nodes);
    			div14 = claim_element(div15_nodes, "DIV", { id: true, class: true });
    			var div14_nodes = children(div14);
    			div13 = claim_element(div14_nodes, "DIV", { class: true });
    			var div13_nodes = children(div13);
    			claim_component(scrolltotop.$$.fragment, div13_nodes);
    			div13_nodes.forEach(detach_dev);
    			div14_nodes.forEach(detach_dev);
    			div15_nodes.forEach(detach_dev);
    			this.h();
    		},
    		h: function hydrate() {
    			attr_dev(div0, "id", "email-alert-signup");
    			attr_dev(div0, "class", "email-subscribefooter svelte-6oiabe");
    			add_location(div0, file, 245, 8, 9463);
    			attr_dev(div1, "class", "footer-itemsignup svelte-6oiabe");
    			add_location(div1, file, 244, 4, 9422);
    			attr_dev(ul0, "class", "svelte-6oiabe");
    			add_location(ul0, file, 279, 12, 10895);
    			attr_dev(div2, "class", "content-asset ca-online-only svelte-6oiabe");
    			add_location(div2, file, 278, 8, 10839);
    			attr_dev(div3, "class", "social-icons svelte-6oiabe");
    			add_location(div3, file, 277, 4, 10803);
    			attr_dev(a0, "aria-label", "Mobile Apps");
    			attr_dev(a0, "href", "https://www.ashleyfurniture.com/mobileapp/");
    			attr_dev(a0, "class", "svelte-6oiabe");
    			add_location(a0, file, 322, 12, 12638);
    			attr_dev(div4, "class", "content-asset ca-online-only");
    			add_location(div4, file, 321, 8, 12582);
    			attr_dev(div5, "class", "mobile-apps svelte-6oiabe");
    			add_location(div5, file, 320, 4, 12547);
    			attr_dev(div6, "class", "clearfix svelte-6oiabe");
    			add_location(div6, file, 329, 4, 12880);
    			attr_dev(div7, "class", "footer-link-lists svelte-6oiabe");
    			add_location(div7, file, 330, 4, 12910);
    			attr_dev(span, "class", "svelte-6oiabe");
    			add_location(span, file, 351, 16, 13825);
    			attr_dev(a1, "href", "https://www.ashleyfurniture.com/choose-country-region/");
    			attr_dev(a1, "class", "svelte-6oiabe");
    			add_location(a1, file, 348, 12, 13640);
    			attr_dev(div8, "class", "content-asset ca-online-only");
    			add_location(div8, file, 347, 8, 13584);
    			attr_dev(div9, "class", "country-link svelte-6oiabe");
    			add_location(div9, file, 346, 4, 13548);
    			attr_dev(div10, "class", "copyright-text svelte-6oiabe");
    			add_location(div10, file, 355, 4, 13903);
    			attr_dev(h4, "class", "svelte-6oiabe");
    			add_location(h4, file, 358, 12, 14047);
    			attr_dev(ul1, "class", "svelte-6oiabe");
    			add_location(ul1, file, 359, 12, 14090);
    			attr_dev(div11, "class", "content-asset ca-online-only svelte-6oiabe");
    			add_location(div11, file, 357, 8, 13991);
    			attr_dev(div12, "class", "hide-for-mobile bottom-links svelte-6oiabe");
    			add_location(div12, file, 356, 4, 13939);
    			attr_dev(div13, "class", "img-container svelte-6oiabe");
    			add_location(div13, file, 369, 8, 14427);
    			attr_dev(div14, "id", "scroll-to-top");
    			attr_dev(div14, "class", "scroll-to-top svelte-6oiabe");
    			add_location(div14, file, 368, 4, 14371);
    			attr_dev(div15, "class", "footer svelte-6oiabe");
    			add_location(div15, file, 243, 0, 9396);
    		},
    		m: function mount(target, anchor) {
    			insert_hydration_dev(target, div15, anchor);
    			append_hydration_dev(div15, div1);
    			append_hydration_dev(div1, div0);
    			mount_component(input, div0, null);
    			append_hydration_dev(div0, t0);
    			mount_component(button, div0, null);
    			append_hydration_dev(div1, t1);
    			if (if_block) if_block.m(div1, null);
    			append_hydration_dev(div15, t2);
    			append_hydration_dev(div15, div3);
    			append_hydration_dev(div3, div2);
    			append_hydration_dev(div2, ul0);
    			mount_component(listitem0, ul0, null);
    			append_hydration_dev(ul0, t3);
    			mount_component(listitem1, ul0, null);
    			append_hydration_dev(ul0, t4);
    			mount_component(listitem2, ul0, null);
    			append_hydration_dev(ul0, t5);
    			mount_component(listitem3, ul0, null);
    			append_hydration_dev(ul0, t6);
    			mount_component(listitem4, ul0, null);
    			append_hydration_dev(div15, t7);
    			append_hydration_dev(div15, div5);
    			append_hydration_dev(div5, div4);
    			append_hydration_dev(div4, a0);
    			mount_component(mobileappicon, a0, null);
    			append_hydration_dev(a0, t8);
    			append_hydration_dev(div15, t9);
    			append_hydration_dev(div15, div6);
    			append_hydration_dev(div15, t10);
    			append_hydration_dev(div15, div7);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				each_blocks_1[i].m(div7, null);
    			}

    			append_hydration_dev(div15, t11);
    			append_hydration_dev(div15, div9);
    			append_hydration_dev(div9, div8);
    			append_hydration_dev(div8, a1);
    			mount_component(flagamericathumbnail, a1, null);
    			append_hydration_dev(a1, t12);
    			append_hydration_dev(a1, span);
    			append_hydration_dev(span, t13);
    			append_hydration_dev(div15, t14);
    			append_hydration_dev(div15, div10);
    			append_hydration_dev(div15, t15);
    			append_hydration_dev(div15, div12);
    			append_hydration_dev(div12, div11);
    			append_hydration_dev(div11, h4);
    			append_hydration_dev(h4, t16);
    			append_hydration_dev(div11, t17);
    			append_hydration_dev(div11, ul1);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul1, null);
    			}

    			append_hydration_dev(div15, t18);
    			append_hydration_dev(div15, div14);
    			append_hydration_dev(div14, div13);
    			mount_component(scrolltotop, div13, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const input_changes = {};

    			if (!updating_value && dirty & /*emailAlertAddress*/ 1) {
    				updating_value = true;
    				input_changes.value = /*emailAlertAddress*/ ctx[0];
    				add_flush_callback(() => updating_value = false);
    			}

    			input.$set(input_changes);
    			const button_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				button_changes.$$scope = { dirty, ctx };
    			}

    			button.$set(button_changes);

    			if (current_block_type !== (current_block_type = select_block_type(ctx))) {
    				if (if_block) if_block.d(1);
    				if_block = current_block_type && current_block_type(ctx);

    				if (if_block) {
    					if_block.c();
    					if_block.m(div1, null);
    				}
    			}

    			const listitem0_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				listitem0_changes.$$scope = { dirty, ctx };
    			}

    			listitem0.$set(listitem0_changes);
    			const listitem1_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				listitem1_changes.$$scope = { dirty, ctx };
    			}

    			listitem1.$set(listitem1_changes);
    			const listitem2_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				listitem2_changes.$$scope = { dirty, ctx };
    			}

    			listitem2.$set(listitem2_changes);
    			const listitem3_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				listitem3_changes.$$scope = { dirty, ctx };
    			}

    			listitem3.$set(listitem3_changes);
    			const listitem4_changes = {};

    			if (dirty & /*$$scope*/ 16384) {
    				listitem4_changes.$$scope = { dirty, ctx };
    			}

    			listitem4.$set(listitem4_changes);

    			if (dirty & /*footerLinkLists*/ 8) {
    				each_value_1 = /*footerLinkLists*/ ctx[3];
    				validate_each_argument(each_value_1);
    				let i;

    				for (i = 0; i < each_value_1.length; i += 1) {
    					const child_ctx = get_each_context_1(ctx, each_value_1, i);

    					if (each_blocks_1[i]) {
    						each_blocks_1[i].p(child_ctx, dirty);
    						transition_in(each_blocks_1[i], 1);
    					} else {
    						each_blocks_1[i] = create_each_block_1(child_ctx);
    						each_blocks_1[i].c();
    						transition_in(each_blocks_1[i], 1);
    						each_blocks_1[i].m(div7, null);
    					}
    				}

    				group_outros();

    				for (i = each_value_1.length; i < each_blocks_1.length; i += 1) {
    					out(i);
    				}

    				check_outros();
    			}

    			if (dirty & /*termsPolicies*/ 4) {
    				each_value = /*termsPolicies*/ ctx[2].links;
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
    						each_blocks[i].m(ul1, null);
    					}
    				}

    				group_outros();

    				for (i = each_value.length; i < each_blocks.length; i += 1) {
    					out_1(i);
    				}

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(input.$$.fragment, local);
    			transition_in(button.$$.fragment, local);
    			transition_in(listitem0.$$.fragment, local);
    			transition_in(listitem1.$$.fragment, local);
    			transition_in(listitem2.$$.fragment, local);
    			transition_in(listitem3.$$.fragment, local);
    			transition_in(listitem4.$$.fragment, local);
    			transition_in(mobileappicon.$$.fragment, local);

    			for (let i = 0; i < each_value_1.length; i += 1) {
    				transition_in(each_blocks_1[i]);
    			}

    			transition_in(flagamericathumbnail.$$.fragment, local);

    			for (let i = 0; i < each_value.length; i += 1) {
    				transition_in(each_blocks[i]);
    			}

    			transition_in(scrolltotop.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(input.$$.fragment, local);
    			transition_out(button.$$.fragment, local);
    			transition_out(listitem0.$$.fragment, local);
    			transition_out(listitem1.$$.fragment, local);
    			transition_out(listitem2.$$.fragment, local);
    			transition_out(listitem3.$$.fragment, local);
    			transition_out(listitem4.$$.fragment, local);
    			transition_out(mobileappicon.$$.fragment, local);
    			each_blocks_1 = each_blocks_1.filter(Boolean);

    			for (let i = 0; i < each_blocks_1.length; i += 1) {
    				transition_out(each_blocks_1[i]);
    			}

    			transition_out(flagamericathumbnail.$$.fragment, local);
    			each_blocks = each_blocks.filter(Boolean);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				transition_out(each_blocks[i]);
    			}

    			transition_out(scrolltotop.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div15);
    			destroy_component(input);
    			destroy_component(button);

    			if (if_block) {
    				if_block.d();
    			}

    			destroy_component(listitem0);
    			destroy_component(listitem1);
    			destroy_component(listitem2);
    			destroy_component(listitem3);
    			destroy_component(listitem4);
    			destroy_component(mobileappicon);
    			destroy_each(each_blocks_1, detaching);
    			destroy_component(flagamericathumbnail);
    			destroy_each(each_blocks, detaching);
    			destroy_component(scrolltotop);
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

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('Footer', slots, []);
    	let emailAlertAddress = '', showEmailSuccess;

    	let termsPolicies = {
    		name: 'Terms & Policies',
    		links: [
    			{
    				//name: $t('footer.terms.offers'),
    				name: 'footer.terms.offers',
    				url: 'https://www.ashleyfurniture.com/coupons-deals-and-offers/'
    			},
    			{
    				//name: $t('footer.terms.conditions'),
    				name: 'footer.terms.conditions',
    				url: 'https://www.ashleyfurniture.com/terms-and-conditions/'
    			},
    			{
    				//name: $t('footer.terms.use'),
    				name: 'footer.terms.use',
    				url: 'https://www.ashleyfurniture.com/terms-of-use/'
    			},
    			{
    				//name: $t('footer.terms.privacy'),
    				name: 'footer.terms.privacy',
    				url: 'https://www.ashleyfurniture.com/privacy-policy/'
    			},
    			{
    				//name: $t('footer.terms.ads'),
    				name: 'footer.terms.ads',
    				url: '/interest-based-ads/',
    				target: '_self'
    			},
    			{
    				//name: $t('footer.terms.personal'),
    				name: 'footer.terms.personal',
    				url: 'http://preferences.ashleyfurniture.com',
    				target: '_blank'
    			}
    		]
    	};

    	let footerLinkLists = [
    		{
    			//name: $t('footer.links.know'),
    			name: 'footer.links.know',
    			links: [
    				{
    					//name: $t('footer.links.about-ah'),
    					name: 'footer.links.about-ah',
    					url: 'https://www.ashleyfurniture.com/about-us/'
    				},
    				{
    					//name: $t('footer.links.history'),
    					name: 'footer.links.history',
    					url: 'https://www.ashleyfurnitureindustriesinc.com/en/company/history',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.about-afi'),
    					name: 'footer.links.about-afi',
    					url: 'https://www.ashleyfurnitureindustriesinc.com/en/company/company-overview',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.careers'),
    					name: 'footer.links.careers',
    					url: 'https://ashleycareers.ttcportals.com/',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.news'),
    					name: 'footer.links.news',
    					url: 'https://www.ashleyfurnitureindustriesinc.com/news',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.social'),
    					name: 'footer.links.social',
    					url: 'https://www.ashleyfurniture.com/social-responsibility/'
    				},
    				{
    					//name: $t('footer.links.location'),
    					name: 'footer.links.location',
    					url: 'https://stores.ashleyfurniture.com'
    				},
    				{
    					//name: $t('footer.links.trade'),
    					name: 'footer.links.trade',
    					url: 'https://www.ashleyfurniture.com/trade/'
    				}
    			]
    		},
    		{
    			//name: $t('footer.links.cc'),
    			name: 'footer.links.cc',
    			links: [
    				{
    					//name: $t('footer.links.help'),
    					name: 'footer.links.help',
    					url: '/ask-ashley/',
    					target: '_self'
    				},
    				{
    					//name: $t('footer.links.contact'),
    					name: 'footer.links.contact',
    					url: '/ask-ashley/',
    					target: '_self'
    				},
    				{
    					//name: $t('footer.links.financing'),
    					name: 'footer.links.financing',
    					url: 'https://www.ashleyfurniture.com/financing/'
    				},
    				{
    					//name: $t('footer.links.returns'),
    					name: 'footer.links.returns',
    					url: 'https://www.ashleyfurniture.com/on/demandware.store/Sites-Ashley-US-Site/default/AskAshley-ShowPage?pname=returns'
    				},
    				{
    					//name: $t('footer.links.accessibility'),
    					name: 'footer.links.accessibility',
    					url: 'https://www.essentialaccessibility.com/ashley-homestore/',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.notifications'),
    					name: 'footer.links.notifications',
    					url: 'https://www.ashleyfurnitureindustriesinc.com/consumer-notifications',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.faq'),
    					name: 'footer.links.faq',
    					url: 'https://www.ashleyfurniture.com/on/demandware.store/Sites-Ashley-US-Site/default/AskAshley-ShowPage?pname=faqs'
    				},
    				{
    					//name: $t('footer.links.price-match'),
    					name: 'footer.links.price-match',
    					url: 'https://www.ashleyfurniture.com/price-match/'
    				},
    				{
    					//name: $t('footer.links.child'),
    					name: 'footer.links.child',
    					url: 'https://www.ashleyfurniture.com/anchorit/'
    				},
    				{
    					//name: $t('footer.links.warranty'),
    					name: 'footer.links.warranty',
    					url: '/warranty/',
    					target: '_self'
    				},
    				{
    					//name: $t('footer.links.product-care'),
    					name: 'footer.links.product-care',
    					url: 'https://www.ashleyfurniture.com/care-and-cleaning/'
    				},
    				{
    					//name: $t('footer.links.protection'),
    					name: 'footer.links.protection',
    					url: 'https://www.ashleyfurniture.com/furniture-protection/'
    				}
    			]
    		},
    		{
    			//name: $t('footer.links.inspired'),
    			name: 'footer.links.inspired',
    			links: [
    				{
    					//name: $t('footer.links.blog'),
    					name: 'footer.links.blog',
    					url: 'https://blog.ashleyfurniture.com',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.ideas'),
    					name: 'footer.links.ideas',
    					url: 'https://www.ashleyfurniture.com/c/shop-by/'
    				},
    				{
    					//name: $t('footer.links.catalog'),
    					name: 'footer.links.catalog',
    					url: 'https://www.ashleyfurniture.com/digital-catalog/'
    				},
    				{
    					//name: $t('footer.links.3d'),
    					name: 'footer.links.3d',
    					url: 'https://roombuilder.ashleyfurniture.com',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.dream'),
    					name: 'footer.links.dream',
    					url: 'https://www.ahopetodream.com/',
    					target: '_blank',
    					rel: 'noopener noreferrer'
    				},
    				{
    					//name: $t('footer.links.refer'),
    					name: 'footer.links.refer',
    					url: 'https://www.ashleyfurniture.com/referafriend/'
    				}
    			]
    		}
    	];

    	function emailAlertSignup() {
    		if (emailAlertAddress && emailAlertAddress.trim() != '') {
    			$$invalidate(1, showEmailSuccess = true);
    		} else {
    			$$invalidate(1, showEmailSuccess = false);
    		}
    	}

    	onMount(() => {
    		navStore.set(false);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<Footer> was created with unknown prop '${key}'`);
    	});

    	function input_value_binding(value) {
    		emailAlertAddress = value;
    		$$invalidate(0, emailAlertAddress);
    	}

    	$$self.$capture_state = () => ({
    		SocialInstagramIcon: Social_instagram_icon,
    		SocialFacebookIcon: Social_facebook_icon,
    		SocialPinterestIcon: Social_pinterest_icon,
    		SocialTwitterIcon: Social_twitter_icon,
    		SocialYoutubeIcon: Social_youtube_icon,
    		FlagAmericaThumbnail: Flag_america_thumbnail,
    		MobileAppIcon: Mobile_app_icon,
    		ScrollToTop: Scroll_to_top,
    		Input,
    		Button,
    		ListItem,
    		onMount,
    		navStore,
    		emailAlertAddress,
    		showEmailSuccess,
    		termsPolicies,
    		footerLinkLists,
    		emailAlertSignup
    	});

    	$$self.$inject_state = $$props => {
    		if ('emailAlertAddress' in $$props) $$invalidate(0, emailAlertAddress = $$props.emailAlertAddress);
    		if ('showEmailSuccess' in $$props) $$invalidate(1, showEmailSuccess = $$props.showEmailSuccess);
    		if ('termsPolicies' in $$props) $$invalidate(2, termsPolicies = $$props.termsPolicies);
    		if ('footerLinkLists' in $$props) $$invalidate(3, footerLinkLists = $$props.footerLinkLists);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [
    		emailAlertAddress,
    		showEmailSuccess,
    		termsPolicies,
    		footerLinkLists,
    		emailAlertSignup,
    		input_value_binding
    	];
    }

    class Footer extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Footer",
    			options,
    			id: create_fragment.name
    		});
    	}
    }

    return Footer;

})();
//# sourceMappingURL=Footer.js.map
