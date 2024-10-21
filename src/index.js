const path = require('path');
const webpack = require('webpack');

class ComponentLocatorPlugin {
    constructor(options = {}) {
        this.options = Object.assign({
            editor: 'vscode',
            componentExtensions: ['.vue', '.js', '.ts', '.jsx', '.tsx'],
            triggerKey: 'both',
            srcDir: 'src',
            forceEnable: false
        }, options);
    }

    apply(compiler) {
        const isDevelopment = compiler.options.mode === 'development';

        if (!isDevelopment && !this.options.forceEnable) {
            return;
        }

        compiler.hooks.afterCompile.tapAsync('ComponentLocatorPlugin', (compilation, callback) => {
            const componentsMap = {};

            compilation.modules.forEach(module => {
                if (module.resource) {
                    const ext = path.extname(module.resource);
                    if (this.options.componentExtensions.includes(ext)) {
                        const relativePath = path.relative(compiler.context, module.resource);
                        if (relativePath.startsWith(this.options.srcDir)) {
                            componentsMap[relativePath] = module.resource;
                        }
                    }
                }
            });


            const scriptContent = this.generateScriptContent(compiler.context, componentsMap);

            compilation.assets['component-locator.js'] = {
                source: () => scriptContent,
                size: () => scriptContent.length
            };

            callback();
        });

        compiler.hooks.compilation.tap('ComponentLocatorPlugin', (compilation) => {
            const HtmlWebpackPlugin = require('html-webpack-plugin');

            const addScriptToHtml = (data, cb) => {
                data.html = data.html.replace(
                    '</body>',
                    '<script src="/component-locator.js"></script></body>'
                );
                cb(null, data);
            };

            if (HtmlWebpackPlugin.getHooks) {
                HtmlWebpackPlugin.getHooks(compilation).beforeEmit.tapAsync(
                    'ComponentLocatorPlugin',
                    addScriptToHtml
                );
            } else {
                compilation.hooks.htmlWebpackPluginAfterHtmlProcessing.tapAsync(
                    'ComponentLocatorPlugin',
                    addScriptToHtml
                );
            }
        });
    }

    generateScriptContent(context, componentsMap) {
        let triggerCondition;
        switch(this.options.triggerKey) {
            case 'ctrl':
                triggerCondition = 'event.ctrlKey';
                break;
            case 'cmd':
                triggerCondition = 'event.metaKey';
                break;
            default:
                triggerCondition = 'event.ctrlKey || event.metaKey';
        }

        return `
            (function(global) {
                let clickHandler;

                function initComponentLocator() {
                    cleanupComponentLocator();  // 清理旧的监听器和数据

                    global.__COMPONENT_LOCATOR__ = ${JSON.stringify(componentsMap)};
                    global.__COMPONENT_LOCATOR_CONTEXT__ = ${JSON.stringify(context)};
                    
                    function findComponentPath(element) {
                        console.log('Searching for component on element:', element);
                        
                        // Vue 3
                        let vueInstance = element.__vueParentComponent;
                        if (vueInstance) {
                            console.log('Vue 3 instance found:', vueInstance);
                            let fileName;
                            
                            while (vueInstance && !fileName) {
                                if (vueInstance.type && vueInstance.type.__file) {
                                    fileName = vueInstance.type.__file;
                                    break;
                                }
                                vueInstance = vueInstance.parent;
                            }
                            
                            console.log('File name:', fileName);
                            if (fileName) {
                                const relativePath = fileName.replace(global.__COMPONENT_LOCATOR_CONTEXT__, '').replace(/^[\\/]/, '');
                                console.log('Relative path:', relativePath);
                                const fullPath = global.__COMPONENT_LOCATOR__[relativePath];
                                console.log('Full path:', fullPath);
                                return fullPath;
                            }
                        }
                        
                        // Vue 2
                        const vue2Instance = element.__vue__;
                        if (vue2Instance) {
                            console.log('Vue 2 instance found:', vue2Instance);
                            const fileName = vue2Instance.$options && vue2Instance.$options.__file;
                            console.log('File name:', fileName);
                            if (fileName) {
                                const relativePath = fileName.replace(global.__COMPONENT_LOCATOR_CONTEXT__, '').replace(/^[\\/]/, '');
                                console.log('Relative path:', relativePath);
                                const fullPath = global.__COMPONENT_LOCATOR__[relativePath];
                                console.log('Full path:', fullPath);
                                return fullPath;
                            }
                        }
                        
                        return null;
                    }

                    function openInEditor(path) {
                        const editor = '${this.options.editor}' || 'vscode';
                        let url;

                        switch (editor) {
                            case 'vscode':
                                url = \`vscode://file\${path}\`;
                                break;
                            case 'webstorm':
                                const formattedPath = path.replace(/^[A-Z]:/, '').replace(/\\\\/g, '/');
                                url = \`webstorm://open?file=\${formattedPath}\`;
                                break;
                            // Add cases for other editors as needed
                            default:
                                console.warn(\`Unsupported editor: \${editor}\`);
                                return;
                        }

                        console.log(\`Opening file in \${editor}: \${url}\`);
                        global.location.assign(url);
                    }

                    clickHandler = (event) => {
                        if (${triggerCondition}) {
                            console.log('Trigger key + Click detected');
                            event.preventDefault();
                            event.stopPropagation();
                            
                            let element = event.target;
                            let componentPath = null;
                            
                            while (element && !componentPath) {
                                console.log('Checking element:', element);
                                componentPath = findComponentPath(element);
                                if (!componentPath) {
                                    element = element.parentElement;
                                }
                            }

                            if (componentPath) {
                                console.log('Component path found:', componentPath);
                                openInEditor(componentPath);
                            } else {
                                console.log('No component path found');
                            }
                        }
                    };

                    document.addEventListener('click', clickHandler);

                    console.log('Component locator script loaded');
                    console.log('Component map:', global.__COMPONENT_LOCATOR__);
                    console.log('Context:', global.__COMPONENT_LOCATOR_CONTEXT__);
                }

                function cleanupComponentLocator() {
                    if (clickHandler) {
                        document.removeEventListener('click', clickHandler);
                        clickHandler = null;
                    }
                    delete global.__COMPONENT_LOCATOR__;
                    delete global.__COMPONENT_LOCATOR_CONTEXT__;
                    console.log('Component locator cleaned up');
                }

                // 初始化
                initComponentLocator();

                // 暴露全局函数用于重新初始化和清理
                global.__REINIT_COMPONENT_LOCATOR__ = initComponentLocator;
                global.__CLEANUP_COMPONENT_LOCATOR__ = cleanupComponentLocator;

                // Webpack HMR 支持
                if (global.webpackHotUpdate) {
                    global.webpackHotUpdate = (function(originalHotUpdate) {
                        return function() {
                            if (originalHotUpdate) {
                                originalHotUpdate.apply(this, arguments);
                            }
                            global.__REINIT_COMPONENT_LOCATOR__();
                        };
                    })(global.webpackHotUpdate);
                }

            })(typeof self !== 'undefined' ? self : this);
        `;
    }
}

module.exports = ComponentLocatorPlugin;