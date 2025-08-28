// 全局变量
let selectedAPIs = JSON.parse(
  localStorage.getItem("selectedAPIs") || '["tyyszy","dyttzy", "bfzy", "ruyi"]'
); // 默认选中资源
let customAPIs = JSON.parse(localStorage.getItem("customAPIs") || "[]"); // 存储自定义API列表

// 添加当前播放的集数索引
let currentEpisodeIndex = 0;
// 添加当前视频的所有集数
let currentEpisodes = [];
// 添加当前视频的标题
let currentVideoTitle = "";
// 全局变量用于倒序状态
let episodesReversed = false;

// 页面初始化
document.addEventListener("DOMContentLoaded", function () {
  // 初始化API复选框
  initAPICheckboxes();

  // 初始化自定义API列表
  renderCustomAPIsList();

  // 初始化显示选中的API数量
  updateSelectedApiCount();

  // 渲染搜索历史
  renderSearchHistory();

  // 设置默认API选择（如果是第一次加载）
  if (!localStorage.getItem("hasInitializedDefaults")) {
    // 默认选中资源
    selectedAPIs = ["tyyszy", "bfzy", "dyttzy", "ruyi"];
    localStorage.setItem("selectedAPIs", JSON.stringify(selectedAPIs));

    // 默认选中过滤开关
    localStorage.setItem("yellowFilterEnabled", "true");
    localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, "true");

    // 默认启用豆瓣功能
    localStorage.setItem("doubanEnabled", "true");

    // 默认搜索批次大小
    localStorage.setItem("searchBatchSize", "5");

    // 标记已初始化默认值
    localStorage.setItem("hasInitializedDefaults", "true");
  }

  // 设置黄色内容过滤器开关初始状态
  const yellowFilterToggle = document.getElementById("yellowFilterToggle");
  if (yellowFilterToggle) {
    yellowFilterToggle.checked =
      localStorage.getItem("yellowFilterEnabled") === "true";
  }

  // 设置广告过滤开关初始状态
  const adFilterToggle = document.getElementById("adFilterToggle");
  if (adFilterToggle) {
    adFilterToggle.checked =
      localStorage.getItem(PLAYER_CONFIG.adFilteringStorage) !== "false"; // 默认为true
  }

  // 设置搜索批次大小初始状态
  const batchSizeSlider = document.getElementById("batchSizeSlider");
  const batchSizeInput = document.getElementById("batchSizeInput");
  const batchSizeValue = document.getElementById("batchSizeValue");

  if (batchSizeSlider && batchSizeInput && batchSizeValue) {
    const savedBatchSize = localStorage.getItem("searchBatchSize") || "5";
    batchSizeSlider.value = savedBatchSize;
    batchSizeInput.value = savedBatchSize;
    batchSizeValue.textContent = savedBatchSize;
  }

  // 设置事件监听器
  setupEventListeners();

  // 初始检查成人API选中状态
  setTimeout(checkAdultAPIsSelected, 100);

  // 添加页面离开时的搜索取消逻辑
  setupPageLeaveHandlers();

  // 检查URL参数，处理搜索状态
  checkURLForSearchState();
});

// 检查URL中的搜索状态
function checkURLForSearchState() {
  const path = window.location.pathname;

  if (path.startsWith("/s=")) {
    const query = decodeURIComponent(path.substring(3));
    const state = history.state;

    // 优先检查缓存结果（无论state状态如何）
    const cacheKey = `searchResults_${query}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const parsedData = JSON.parse(cachedData);

        // 检查缓存是否过期（2小时）
        const cacheAge = Date.now() - parsedData.timestamp;
        const cacheExpirationTime = 2 * 60 * 60 * 1000; // 2小时

        if (cacheAge < cacheExpirationTime) {
          // 缓存有效，直接显示
          displayCachedResults(parsedData, query);
          return;
        } else {
          // 缓存过期，删除
          localStorage.removeItem(cacheKey);
        }
      } catch (e) {
        console.error("解析缓存数据失败:", e);
        localStorage.removeItem(cacheKey);
      }
    }

    // 如果没有有效缓存，再检查state状态
    if (state && state.status === "searching") {
      // 正在搜索状态，显示搜索中界面
      showSearchingState(query);
    } else {
      // 没有缓存也没有搜索状态，重新搜索
      document.getElementById("searchInput").value = query;
      search();
    }
  }
}

// 初始化API复选框
function initAPICheckboxes() {
  const container = document.getElementById("apiCheckboxes");
  container.innerHTML = "";

  // 添加普通API组标题
  const normaldiv = document.createElement("div");
  normaldiv.id = "normaldiv";
  normaldiv.className = "grid grid-cols-2 gap-2";
  const normalTitle = document.createElement("div");
  normalTitle.className = "api-group-title";
  normalTitle.textContent = "普通资源";
  normaldiv.appendChild(normalTitle);

  // 创建普通API源的复选框
  Object.keys(API_SITES).forEach((apiKey) => {
    const api = API_SITES[apiKey];
    if (api.adult) return; // 跳过成人内容API，稍后添加

    const checked = selectedAPIs.includes(apiKey);

    const checkbox = document.createElement("div");
    checkbox.className = "flex items-center";
    checkbox.innerHTML = `
            <input type="checkbox" id="api_${apiKey}" 
                   class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333]" 
                   ${checked ? "checked" : ""} 
                   data-api="${apiKey}">
            <label for="api_${apiKey}" class="ml-1 text-xs text-gray-400 truncate">${
      api.name
    }</label>
        `;
    normaldiv.appendChild(checkbox);

    // 添加事件监听器
    checkbox.querySelector("input").addEventListener("change", function () {
      updateSelectedAPIs();
      checkAdultAPIsSelected();
    });
  });
  container.appendChild(normaldiv);

  // 添加成人API列表
  addAdultAPI();

  // 初始检查成人内容状态
  checkAdultAPIsSelected();
}

// 添加成人API列表
function addAdultAPI() {
  // 仅在隐藏设置为false时添加成人API组
  if (
    !HIDE_BUILTIN_ADULT_APIS &&
    localStorage.getItem("yellowFilterEnabled") === "false"
  ) {
    const container = document.getElementById("apiCheckboxes");

    // 添加成人API组标题
    const adultdiv = document.createElement("div");
    adultdiv.id = "adultdiv";
    adultdiv.className = "grid grid-cols-2 gap-2";
    const adultTitle = document.createElement("div");
    adultTitle.className = "api-group-title adult";
    adultTitle.innerHTML = `黄色资源采集站 <span class="adult-warning">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
        </span>`;
    adultdiv.appendChild(adultTitle);

    // 创建成人API源的复选框
    Object.keys(API_SITES).forEach((apiKey) => {
      const api = API_SITES[apiKey];
      if (!api.adult) return; // 仅添加成人内容API

      const checked = selectedAPIs.includes(apiKey);

      const checkbox = document.createElement("div");
      checkbox.className = "flex items-center";
      checkbox.innerHTML = `
                <input type="checkbox" id="api_${apiKey}" 
                       class="form-checkbox h-3 w-3 text-blue-600 bg-[#222] border border-[#333] api-adult" 
                       ${checked ? "checked" : ""} 
                       data-api="${apiKey}">
                <label for="api_${apiKey}" class="ml-1 text-xs text-pink-400 truncate">${
        api.name
      }</label>
            `;
      adultdiv.appendChild(checkbox);

      // 添加事件监听器
      checkbox.querySelector("input").addEventListener("change", function () {
        updateSelectedAPIs();
        checkAdultAPIsSelected();
      });
    });
    container.appendChild(adultdiv);
  }
}

// 检查是否有成人API被选中
function checkAdultAPIsSelected() {
  // 查找所有内置成人API复选框
  const adultBuiltinCheckboxes = document.querySelectorAll(
    "#apiCheckboxes .api-adult:checked"
  );

  // 查找所有自定义成人API复选框
  const customApiCheckboxes = document.querySelectorAll(
    "#customApisList .api-adult:checked"
  );

  const hasAdultSelected =
    adultBuiltinCheckboxes.length > 0 || customApiCheckboxes.length > 0;

  const yellowFilterToggle = document.getElementById("yellowFilterToggle");
  const yellowFilterContainer = yellowFilterToggle.closest("div").parentNode;
  const filterDescription = yellowFilterContainer.querySelector(
    "p.filter-description"
  );

  // 如果选择了成人API，禁用黄色内容过滤器
  if (hasAdultSelected) {
    yellowFilterToggle.checked = false;
    yellowFilterToggle.disabled = true;
    localStorage.setItem("yellowFilterEnabled", "false");

    // 添加禁用样式
    yellowFilterContainer.classList.add("filter-disabled");

    // 修改描述文字
    if (filterDescription) {
      filterDescription.innerHTML =
        '<strong class="text-pink-300">选中黄色资源站时无法启用此过滤</strong>';
    }

    // 移除提示信息（如果存在）
    const existingTooltip =
      yellowFilterContainer.querySelector(".filter-tooltip");
    if (existingTooltip) {
      existingTooltip.remove();
    }
  } else {
    // 启用黄色内容过滤器
    yellowFilterToggle.disabled = false;
    yellowFilterContainer.classList.remove("filter-disabled");

    // 恢复原来的描述文字
    if (filterDescription) {
      filterDescription.innerHTML = '过滤"伦理片"等黄色内容';
    }

    // 移除提示信息
    const existingTooltip =
      yellowFilterContainer.querySelector(".filter-tooltip");
    if (existingTooltip) {
      existingTooltip.remove();
    }
  }
}

// 渲染自定义API列表
function renderCustomAPIsList() {
  const container = document.getElementById("customApisList");
  if (!container) return;

  if (customAPIs.length === 0) {
    container.innerHTML =
      '<p class="text-xs text-gray-500 text-center my-2">未添加自定义API</p>';
    return;
  }

  container.innerHTML = "";
  customAPIs.forEach((api, index) => {
    const apiItem = document.createElement("div");
    apiItem.className =
      "flex items-center justify-between p-1 mb-1 bg-[#222] rounded";
    const textColorClass = api.isAdult ? "text-pink-400" : "text-white";
    const adultTag = api.isAdult
      ? '<span class="text-xs text-pink-400 mr-1">(18+)</span>'
      : "";
    // 新增 detail 地址显示
    const detailLine = api.detail
      ? `<div class="text-xs text-gray-400 truncate">detail: ${api.detail}</div>`
      : "";
    apiItem.innerHTML = `
            <div class="flex items-center flex-1 min-w-0">
                <input type="checkbox" id="custom_api_${index}" 
                       class="form-checkbox h-3 w-3 text-blue-600 mr-1 ${
                         api.isAdult ? "api-adult" : ""
                       }" 
                       ${
                         selectedAPIs.includes("custom_" + index)
                           ? "checked"
                           : ""
                       } 
                       data-custom-index="${index}">
                <div class="flex-1 min-w-0">
                    <div class="text-xs font-medium ${textColorClass} truncate">
                        ${adultTag}${api.name}
                    </div>
                    <div class="text-xs text-gray-500 truncate">${api.url}</div>
                    ${detailLine}
                </div>
            </div>
            <div class="flex items-center">
                <button class="text-blue-500 hover:text-blue-700 text-xs px-1" onclick="editCustomApi(${index})">✎</button>
                <button class="text-red-500 hover:text-red-700 text-xs px-1" onclick="removeCustomApi(${index})">✕</button>
            </div>
        `;
    container.appendChild(apiItem);
    apiItem.querySelector("input").addEventListener("change", function () {
      updateSelectedAPIs();
      checkAdultAPIsSelected();
    });
  });
}

// 编辑自定义API
function editCustomApi(index) {
  if (index < 0 || index >= customAPIs.length) return;
  const api = customAPIs[index];
  document.getElementById("customApiName").value = api.name;
  document.getElementById("customApiUrl").value = api.url;
  document.getElementById("customApiDetail").value = api.detail || "";
  const isAdultInput = document.getElementById("customApiIsAdult");
  if (isAdultInput) isAdultInput.checked = api.isAdult || false;
  const form = document.getElementById("addCustomApiForm");
  if (form) {
    form.classList.remove("hidden");
    const buttonContainer = form.querySelector("div:last-child");
    buttonContainer.innerHTML = `
            <button onclick="updateCustomApi(${index})" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">更新</button>
            <button onclick="cancelEditCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
        `;
  }
}

// 更新自定义API
function updateCustomApi(index) {
  if (index < 0 || index >= customAPIs.length) return;
  const nameInput = document.getElementById("customApiName");
  const urlInput = document.getElementById("customApiUrl");
  const detailInput = document.getElementById("customApiDetail");
  const isAdultInput = document.getElementById("customApiIsAdult");
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  const detail = detailInput ? detailInput.value.trim() : "";
  const isAdult = isAdultInput ? isAdultInput.checked : false;
  if (!name || !url) {
    showToast("请输入API名称和链接", "warning");
    return;
  }
  if (!/^https?:\/\/.+/.test(url)) {
    showToast("API链接格式不正确，需以http://或https://开头", "warning");
    return;
  }
  if (url.endsWith("/")) url = url.slice(0, -1);
  // 保存 detail 字段
  customAPIs[index] = { name, url, detail, isAdult };
  localStorage.setItem("customAPIs", JSON.stringify(customAPIs));
  renderCustomAPIsList();
  checkAdultAPIsSelected();
  restoreAddCustomApiButtons();
  nameInput.value = "";
  urlInput.value = "";
  if (detailInput) detailInput.value = "";
  if (isAdultInput) isAdultInput.checked = false;
  document.getElementById("addCustomApiForm").classList.add("hidden");
  showToast("已更新自定义API: " + name, "success");
}

// 取消编辑自定义API
function cancelEditCustomApi() {
  // 清空表单
  document.getElementById("customApiName").value = "";
  document.getElementById("customApiUrl").value = "";
  document.getElementById("customApiDetail").value = "";
  const isAdultInput = document.getElementById("customApiIsAdult");
  if (isAdultInput) isAdultInput.checked = false;

  // 隐藏表单
  document.getElementById("addCustomApiForm").classList.add("hidden");

  // 恢复添加按钮
  restoreAddCustomApiButtons();
}

// 恢复自定义API添加按钮
function restoreAddCustomApiButtons() {
  const form = document.getElementById("addCustomApiForm");
  const buttonContainer = form.querySelector("div:last-child");
  buttonContainer.innerHTML = `
        <button onclick="addCustomApi()" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs">添加</button>
        <button onclick="cancelAddCustomApi()" class="bg-[#444] hover:bg-[#555] text-white px-3 py-1 rounded text-xs">取消</button>
    `;
}

// 更新选中的API列表
function updateSelectedAPIs() {
  // 获取所有内置API复选框
  const builtInApiCheckboxes = document.querySelectorAll(
    "#apiCheckboxes input:checked"
  );

  // 获取选中的内置API
  const builtInApis = Array.from(builtInApiCheckboxes).map(
    (input) => input.dataset.api
  );

  // 获取选中的自定义API
  const customApiCheckboxes = document.querySelectorAll(
    "#customApisList input:checked"
  );
  const customApiIndices = Array.from(customApiCheckboxes).map(
    (input) => "custom_" + input.dataset.customIndex
  );

  // 合并内置和自定义API
  selectedAPIs = [...builtInApis, ...customApiIndices];

  // 保存到localStorage
  localStorage.setItem("selectedAPIs", JSON.stringify(selectedAPIs));

  // 更新显示选中的API数量
  updateSelectedApiCount();
}

// 更新选中的API数量显示
function updateSelectedApiCount() {
  const countEl = document.getElementById("selectedApiCount");
  if (countEl) {
    countEl.textContent = selectedAPIs.length;
  }
}

// 全选或取消全选API
function selectAllAPIs(selectAll = true, excludeAdult = false) {
  const checkboxes = document.querySelectorAll(
    '#apiCheckboxes input[type="checkbox"]'
  );

  checkboxes.forEach((checkbox) => {
    if (excludeAdult && checkbox.classList.contains("api-adult")) {
      checkbox.checked = false;
    } else {
      checkbox.checked = selectAll;
    }
  });

  updateSelectedAPIs();
  checkAdultAPIsSelected();
}

// 显示添加自定义API表单
function showAddCustomApiForm() {
  const form = document.getElementById("addCustomApiForm");
  if (form) {
    form.classList.remove("hidden");
  }
}

// 取消添加自定义API - 修改函数来重用恢复按钮逻辑
function cancelAddCustomApi() {
  const form = document.getElementById("addCustomApiForm");
  if (form) {
    form.classList.add("hidden");
    document.getElementById("customApiName").value = "";
    document.getElementById("customApiUrl").value = "";
    document.getElementById("customApiDetail").value = "";
    const isAdultInput = document.getElementById("customApiIsAdult");
    if (isAdultInput) isAdultInput.checked = false;

    // 确保按钮是添加按钮
    restoreAddCustomApiButtons();
  }
}

// 添加自定义API
function addCustomApi() {
  const nameInput = document.getElementById("customApiName");
  const urlInput = document.getElementById("customApiUrl");
  const detailInput = document.getElementById("customApiDetail");
  const isAdultInput = document.getElementById("customApiIsAdult");
  const name = nameInput.value.trim();
  let url = urlInput.value.trim();
  const detail = detailInput ? detailInput.value.trim() : "";
  const isAdult = isAdultInput ? isAdultInput.checked : false;
  if (!name || !url) {
    showToast("请输入API名称和链接", "warning");
    return;
  }
  if (!/^https?:\/\/.+/.test(url)) {
    showToast("API链接格式不正确，需以http://或https://开头", "warning");
    return;
  }
  if (url.endsWith("/")) {
    url = url.slice(0, -1);
  }
  // 保存 detail 字段
  customAPIs.push({ name, url, detail, isAdult });
  localStorage.setItem("customAPIs", JSON.stringify(customAPIs));
  const newApiIndex = customAPIs.length - 1;
  selectedAPIs.push("custom_" + newApiIndex);
  localStorage.setItem("selectedAPIs", JSON.stringify(selectedAPIs));

  // 重新渲染自定义API列表
  renderCustomAPIsList();
  updateSelectedApiCount();
  checkAdultAPIsSelected();
  nameInput.value = "";
  urlInput.value = "";
  if (detailInput) detailInput.value = "";
  if (isAdultInput) isAdultInput.checked = false;
  document.getElementById("addCustomApiForm").classList.add("hidden");
  showToast("已添加自定义API: " + name, "success");
}

// 移除自定义API
function removeCustomApi(index) {
  if (index < 0 || index >= customAPIs.length) return;

  const apiName = customAPIs[index].name;

  // 从列表中移除API
  customAPIs.splice(index, 1);
  localStorage.setItem("customAPIs", JSON.stringify(customAPIs));

  // 从选中列表中移除此API
  const customApiId = "custom_" + index;
  selectedAPIs = selectedAPIs.filter((id) => id !== customApiId);

  // 更新大于此索引的自定义API索引
  selectedAPIs = selectedAPIs.map((id) => {
    if (id.startsWith("custom_")) {
      const currentIndex = parseInt(id.replace("custom_", ""));
      if (currentIndex > index) {
        return "custom_" + (currentIndex - 1);
      }
    }
    return id;
  });

  localStorage.setItem("selectedAPIs", JSON.stringify(selectedAPIs));

  // 重新渲染自定义API列表
  renderCustomAPIsList();

  // 更新选中的API数量
  updateSelectedApiCount();

  // 重新检查成人API选中状态
  checkAdultAPIsSelected();

  showToast("已移除自定义API: " + apiName, "info");
}

function toggleSettings(e) {
  const settingsPanel = document.getElementById("settingsPanel");
  if (!settingsPanel) return;

  if (settingsPanel.classList.contains("show")) {
    settingsPanel.classList.remove("show");
  } else {
    settingsPanel.classList.add("show");
  }

  if (e) {
    e.preventDefault();
    e.stopPropagation();
  }
}

// 设置页面离开时的搜索取消逻辑
function setupPageLeaveHandlers() {
  // 监听页面离开事件（关闭标签页、刷新页面等）
  window.addEventListener("beforeunload", function () {
    if (window.currentSearchAbortController) {
      window.currentSearchAbortController.abort();
    }
    // 清除搜索状态
    window.isSearchActive = false;
    window.currentSearchId = null;
    window.currentSearchQuery = null;
  });

  // 监听页面隐藏事件（切换到其他标签页）
  document.addEventListener("visibilitychange", function () {
    if (document.hidden && window.currentSearchAbortController) {
      // 页面隐藏时不取消搜索，让搜索在后台继续进行
      // 这样用户切换标签页或最小化窗口时，搜索仍会继续
    }
  });
}

// 设置事件监听器
function setupEventListeners() {
  // 回车搜索
  document
    .getElementById("searchInput")
    .addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        search();
      }
    });

  // 点击外部关闭设置面板和历史记录面板
  document.addEventListener("click", function (e) {
    // 关闭设置面板
    const settingsPanel = document.querySelector("#settingsPanel.show");
    const settingsButton = document.querySelector("#settingsPanel .close-btn");

    if (
      settingsPanel &&
      settingsButton &&
      !settingsPanel.contains(e.target) &&
      !settingsButton.contains(e.target)
    ) {
      settingsPanel.classList.remove("show");
    }

    // 关闭历史记录面板
    const historyPanel = document.querySelector("#historyPanel.show");
    const historyButton = document.querySelector("#historyPanel .close-btn");

    if (
      historyPanel &&
      historyButton &&
      !historyPanel.contains(e.target) &&
      !historyButton.contains(e.target)
    ) {
      historyPanel.classList.remove("show");
    }
  });

  // 黄色内容过滤开关事件绑定
  const yellowFilterToggle = document.getElementById("yellowFilterToggle");
  if (yellowFilterToggle) {
    yellowFilterToggle.addEventListener("change", function (e) {
      localStorage.setItem("yellowFilterEnabled", e.target.checked);

      // 控制黄色内容接口的显示状态
      const adultdiv = document.getElementById("adultdiv");
      if (adultdiv) {
        if (e.target.checked === true) {
          adultdiv.style.display = "none";
        } else if (e.target.checked === false) {
          adultdiv.style.display = "";
        }
      } else {
        // 添加成人API列表
        addAdultAPI();
      }
    });
  }

  // 广告过滤开关事件绑定
  const adFilterToggle = document.getElementById("adFilterToggle");
  if (adFilterToggle) {
    adFilterToggle.addEventListener("change", function (e) {
      localStorage.setItem(PLAYER_CONFIG.adFilteringStorage, e.target.checked);
    });
  }

  // 搜索批次大小设置事件绑定
  const batchSizeSlider = document.getElementById("batchSizeSlider");
  const batchSizeInput = document.getElementById("batchSizeInput");
  const batchSizeValue = document.getElementById("batchSizeValue");

  if (batchSizeSlider && batchSizeInput && batchSizeValue) {
    // 滑块变化事件
    batchSizeSlider.addEventListener("input", function (e) {
      const value = e.target.value;
      batchSizeInput.value = value;
      batchSizeValue.textContent = value;
      localStorage.setItem("searchBatchSize", value);
    });

    // 数字输入框变化事件
    batchSizeInput.addEventListener("input", function (e) {
      let value = parseInt(e.target.value);
      // 限制范围在1-20之间
      if (value < 1) value = 1;
      if (value > 20) value = 20;

      batchSizeSlider.value = value;
      batchSizeValue.textContent = value;
      localStorage.setItem("searchBatchSize", value.toString());
    });

    // 数字输入框失去焦点时验证
    batchSizeInput.addEventListener("blur", function (e) {
      let value = parseInt(e.target.value);
      if (isNaN(value) || value < 1) value = 1;
      if (value > 20) value = 20;

      e.target.value = value;
      batchSizeSlider.value = value;
      batchSizeValue.textContent = value;
      localStorage.setItem("searchBatchSize", value.toString());
    });
  }
}

// 重置搜索区域
function resetSearchArea() {
  // 条件取消搜索：只有在明确回到首页时才取消
  if (window.currentSearchAbortController) {
    window.currentSearchAbortController.abort();
  }

  // 清除搜索状态
  window.isSearchActive = false;
  window.currentSearchId = null;
  window.currentSearchQuery = null;

  // 隐藏加载动画
  hideLoading();

  // 清理搜索结果
  document.getElementById("results").innerHTML = "";
  document.getElementById("searchInput").value = "";

  // 恢复搜索区域的样式
  document.getElementById("searchArea").classList.add("flex-1");
  document.getElementById("searchArea").classList.remove("mb-8");
  document.getElementById("resultsArea").classList.add("hidden");

  // 确保页脚正确显示，移除相对定位
  const footer = document.querySelector(".footer");
  if (footer) {
    footer.style.position = "";
  }

  // 如果有豆瓣功能，检查是否需要显示豆瓣推荐区域
  if (typeof updateDoubanVisibility === "function") {
    updateDoubanVisibility();
  }

  // 重置URL为主页
  try {
    window.history.pushState({}, `LibreTV - 免费在线视频搜索与观看平台`, `/`);
    // 更新页面标题
    document.title = `LibreTV - 免费在线视频搜索与观看平台`;
  } catch (e) {
    console.error("更新浏览器历史失败:", e);
  }
}

// 获取自定义API信息
function getCustomApiInfo(customApiIndex) {
  const index = parseInt(customApiIndex);
  if (isNaN(index) || index < 0 || index >= customAPIs.length) {
    return null;
  }
  return customAPIs[index];
}

// 搜索功能 - 修改为支持渐进式搜索
async function search() {
  // 生成当前搜索的唯一标识，用于防止延迟结果覆盖新搜索
  const currentSearchId = Date.now();
  window.currentSearchId = currentSearchId;

  // 设置全局搜索状态
  window.currentSearchQuery = document
    .getElementById("searchInput")
    .value.trim();
  window.isSearchActive = true;

  // 取消之前的搜索（如果存在）
  if (window.currentSearchAbortController) {
    window.currentSearchAbortController.abort();
  }

  // 创建新的 AbortController 用于取消搜索
  window.currentSearchAbortController = new AbortController();
  // 强化的密码保护校验 - 防止绕过
  try {
    if (window.ensurePasswordProtection) {
      window.ensurePasswordProtection();
    } else {
      // 兼容性检查
      if (window.isPasswordProtected && window.isPasswordVerified) {
        if (window.isPasswordProtected() && !window.isPasswordVerified()) {
          showPasswordModal && showPasswordModal();
          return;
        }
      }
    }
  } catch (error) {
    console.warn("Password protection check failed:", error.message);
    return;
  }
  const query = document.getElementById("searchInput").value.trim();

  if (!query) {
    showToast("请输入搜索内容", "info");
    return;
  }

  if (selectedAPIs.length === 0) {
    showToast("请至少选择一个API源", "warning");
    return;
  }

  showLoading();

  // 立即更新URL状态为搜索中
  updateSearchURL(query, "searching");

  // 清除之前的搜索结果，防止延迟结果覆盖
  document.getElementById("results").innerHTML = "";

  try {
    // 保存搜索历史
    saveSearchHistory(query);

    // 分组并行 + 渐进式搜索：使用设置中的批次大小
    let allResults = [];
    const totalAPIs = selectedAPIs.length;
    const batchSize = parseInt(localStorage.getItem("searchBatchSize") || "5"); // 从设置中获取批次大小
    let completedBatches = 0;

    // 按批次分组处理API
    for (let i = 0; i < selectedAPIs.length; i += batchSize) {
      // 检查搜索是否被取消
      if (window.currentSearchAbortController.signal.aborted) {
        return;
      }

      // 获取当前批次的API源
      const currentBatch = selectedAPIs.slice(i, i + batchSize);
      const batchStartIndex = i;
      const batchEndIndex = Math.min(i + batchSize, selectedAPIs.length);

      console.log(
        `🔄 开始搜索批次 ${completedBatches + 1}: API ${
          batchStartIndex + 1
        }-${batchEndIndex}`
      );

      // 并行搜索当前批次的所有API
      const batchPromises = currentBatch.map(async (apiId, batchIndex) => {
        try {
          const results = await searchByAPIAndKeyWord(apiId, query);
          return {
            apiId,
            results: Array.isArray(results) ? results : [],
            success: true,
          };
        } catch (error) {
          console.error(`API ${apiId} 搜索失败:`, error);
          return {
            apiId,
            results: [],
            success: false,
            error: error.message,
          };
        }
      });

      // 等待当前批次的所有API完成
      const batchResults = await Promise.all(batchPromises);

      // 再次检查搜索是否被取消
      if (window.currentSearchAbortController.signal.aborted) {
        return;
      }

      // 合并当前批次的结果
      batchResults.forEach(({ apiId, results, success }) => {
        if (success && results.length > 0) {
          allResults = allResults.concat(results);
          console.log(`✅ API ${apiId} 完成，获得 ${results.length} 个结果`);
        } else if (!success) {
          console.log(`❌ API ${apiId} 搜索失败`);
        }
      });

      completedBatches++;
      const currentStage = Math.min(i + batchSize, totalAPIs);
      const totalStages = totalAPIs;

      // 第一个批次完成后隐藏加载动画
      if (completedBatches === 1) {
        hideLoading();
      }

      // 显示当前进度
      displayProgressiveResults(allResults, currentStage, totalStages, query);
    }

    // 最终处理和显示
    processAndDisplayFinalResults(allResults, query);
  } catch (error) {
    console.error("搜索失败:", error);
    showToast("搜索失败，请重试", "error");
    hideLoading(); // 错误时隐藏加载动画
  }
}

// 切换清空按钮的显示状态
function toggleClearButton() {
  const searchInput = document.getElementById("searchInput");
  const clearButton = document.getElementById("clearSearchInput");
  if (searchInput.value !== "") {
    clearButton.classList.remove("hidden");
  } else {
    clearButton.classList.add("hidden");
  }
}

// 清空搜索框内容
function clearSearchInput() {
  // 条件取消搜索：清空搜索框时取消搜索
  if (window.currentSearchAbortController) {
    window.currentSearchAbortController.abort();
  }

  // 清除搜索状态
  window.isSearchActive = false;
  window.currentSearchId = null;
  window.currentSearchQuery = null;

  // 隐藏加载动画
  hideLoading();

  const searchInput = document.getElementById("searchInput");
  searchInput.value = "";
  const clearButton = document.getElementById("clearSearchInput");
  clearButton.classList.add("hidden");
}

// 劫持搜索框的value属性以检测外部修改
function hookInput() {
  const input = document.getElementById("searchInput");
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  );

  // 重写 value 属性的 getter 和 setter
  Object.defineProperty(input, "value", {
    get: function () {
      // 确保读取时返回字符串（即使原始值为 undefined/null）
      const originalValue = descriptor.get.call(this);
      return originalValue != null ? String(originalValue) : "";
    },
    set: function (value) {
      // 显式将值转换为字符串后写入
      const strValue = String(value);
      descriptor.set.call(this, strValue);
      this.dispatchEvent(new Event("input", { bubbles: true }));
    },
  });

  // 初始化输入框值为空字符串（避免初始值为 undefined）
  input.value = "";
}
document.addEventListener("DOMContentLoaded", hookInput);

// 显示详情 - 修改为支持自定义API
async function showDetails(id, vod_name, sourceCode) {
  // 密码保护校验
  if (window.isPasswordProtected && window.isPasswordVerified) {
    if (window.isPasswordProtected() && !window.isPasswordVerified()) {
      showPasswordModal && showPasswordModal();
      return;
    }
  }
  if (!id) {
    showToast("视频ID无效", "error");
    return;
  }

  showLoading();
  try {
    // 构建API参数
    let apiParams = "";

    // 处理自定义API源
    if (sourceCode.startsWith("custom_")) {
      const customIndex = sourceCode.replace("custom_", "");
      const customApi = getCustomApiInfo(customIndex);
      if (!customApi) {
        showToast("自定义API配置无效", "error");
        hideLoading();
        return;
      }
      // 传递 detail 字段
      if (customApi.detail) {
        apiParams =
          "&customApi=" +
          encodeURIComponent(customApi.url) +
          "&customDetail=" +
          encodeURIComponent(customApi.detail) +
          "&source=custom";
      } else {
        apiParams =
          "&customApi=" + encodeURIComponent(customApi.url) + "&source=custom";
      }
    } else {
      // 内置API
      apiParams = "&source=" + sourceCode;
    }

    // Add a timestamp to prevent caching
    const timestamp = new Date().getTime();
    const cacheBuster = `&_t=${timestamp}`;
    const response = await fetch(
      `/api/detail?id=${encodeURIComponent(id)}${apiParams}${cacheBuster}`
    );

    const data = await response.json();

    const modal = document.getElementById("modal");
    const modalTitle = document.getElementById("modalTitle");
    const modalContent = document.getElementById("modalContent");

    // 显示来源信息
    const sourceName =
      data.videoInfo && data.videoInfo.source_name
        ? ` <span class="text-sm font-normal text-gray-400">(${data.videoInfo.source_name})</span>`
        : "";

    // 不对标题进行截断处理，允许完整显示
    modalTitle.innerHTML = `<span class="break-words">${
      vod_name || "未知视频"
    }</span>${sourceName}`;
    currentVideoTitle = vod_name || "未知视频";

    if (data.episodes && data.episodes.length > 0) {
      // 构建详情信息HTML
      let detailInfoHtml = "";
      if (data.videoInfo) {
        // Prepare description text, strip HTML and trim whitespace
        const descriptionText = data.videoInfo.desc
          ? data.videoInfo.desc.replace(/<[^>]+>/g, "").trim()
          : "";

        // Check if there's any actual grid content
        const hasGridContent =
          data.videoInfo.type ||
          data.videoInfo.year ||
          data.videoInfo.area ||
          data.videoInfo.director ||
          data.videoInfo.actor ||
          data.videoInfo.remarks;

        if (hasGridContent || descriptionText) {
          // Only build if there's something to show
          detailInfoHtml = `
                <div class="modal-detail-info">
                    ${
                      hasGridContent
                        ? `
                    <div class="detail-grid">
                        ${
                          data.videoInfo.type
                            ? `<div class="detail-item"><span class="detail-label">类型:</span> <span class="detail-value">${data.videoInfo.type}</span></div>`
                            : ""
                        }
                        ${
                          data.videoInfo.year
                            ? `<div class="detail-item"><span class="detail-label">年份:</span> <span class="detail-value">${data.videoInfo.year}</span></div>`
                            : ""
                        }
                        ${
                          data.videoInfo.area
                            ? `<div class="detail-item"><span class="detail-label">地区:</span> <span class="detail-value">${data.videoInfo.area}</span></div>`
                            : ""
                        }
                        ${
                          data.videoInfo.director
                            ? `<div class="detail-item"><span class="detail-label">导演:</span> <span class="detail-value">${data.videoInfo.director}</span></div>`
                            : ""
                        }
                        ${
                          data.videoInfo.actor
                            ? `<div class="detail-item"><span class="detail-label">主演:</span> <span class="detail-value">${data.videoInfo.actor}</span></div>`
                            : ""
                        }
                        ${
                          data.videoInfo.remarks
                            ? `<div class="detail-item"><span class="detail-label">备注:</span> <span class="detail-value">${data.videoInfo.remarks}</span></div>`
                            : ""
                        }
                    </div>`
                        : ""
                    }
                    ${
                      descriptionText
                        ? `
                    <div class="detail-desc">
                        <p class="detail-label">简介:</p>
                        <p class="detail-desc-content">${descriptionText}</p>
                    </div>`
                        : ""
                    }
                </div>
                `;
        }
      }

      currentEpisodes = data.episodes;
      currentEpisodeIndex = 0;

      modalContent.innerHTML = `
                ${detailInfoHtml}
                <div class="flex flex-wrap items-center justify-between mb-4 gap-2">
                    <div class="flex items-center gap-2">
                        <button onclick="toggleEpisodeOrder('${sourceCode}', '${id}')" 
                                class="px-3 py-1.5 bg-[#333] hover:bg-[#444] border border-[#444] rounded text-sm transition-colors flex items-center gap-1">
                            <svg class="w-4 h-4 transform ${
                              episodesReversed ? "rotate-180" : ""
                            }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                            </svg>
                            <span>${
                              episodesReversed ? "正序排列" : "倒序排列"
                            }</span>
                        </button>
                        <span class="text-gray-400 text-sm">共 ${
                          data.episodes.length
                        } 集</span>
                    </div>
                    <button onclick="copyLinks()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                        复制链接
                    </button>
                </div>
                <div id="episodesGrid" class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                    ${renderEpisodes(vod_name, sourceCode, id)}
                </div>
            `;
    } else {
      modalContent.innerHTML = `
                <div class="text-center py-8">
                    <div class="text-red-400 mb-2">❌ 未找到播放资源</div>
                    <div class="text-gray-500 text-sm">该视频可能暂时无法播放，请尝试其他视频</div>
                </div>
            `;
    }

    modal.classList.remove("hidden");
  } catch (error) {
    console.error("获取详情错误:", error);
    showToast("获取详情失败，请稍后重试", "error");
  } finally {
    hideLoading();
  }
}

// 更新播放视频函数，修改为使用/watch路径而不是直接打开player.html
function playVideo(url, vod_name, sourceCode, episodeIndex = 0, vodId = "") {
  // 密码保护校验
  if (window.isPasswordProtected && window.isPasswordVerified) {
    if (window.isPasswordProtected() && !window.isPasswordVerified()) {
      showPasswordModal && showPasswordModal();
      return;
    }
  }

  // 获取当前路径作为返回页面
  let currentPath = window.location.pathname + window.location.search;

  // 构建播放页面URL，使用watch.html作为中间跳转页
  let watchUrl = `watch.html?id=${vodId || ""}&source=${
    sourceCode || ""
  }&url=${encodeURIComponent(
    url
  )}&index=${episodeIndex}&title=${encodeURIComponent(vod_name || "")}`;

  // 添加返回URL参数 - 总是传递当前页面作为返回目标
  watchUrl += `&back=${encodeURIComponent(currentPath)}`;

  // 保存当前状态到localStorage
  try {
    localStorage.setItem("currentVideoTitle", vod_name || "未知视频");
    localStorage.setItem("currentEpisodes", JSON.stringify(currentEpisodes));
    localStorage.setItem("currentEpisodeIndex", episodeIndex);
    localStorage.setItem("currentSourceCode", sourceCode || "");
    localStorage.setItem("lastPlayTime", Date.now());
    localStorage.setItem("lastSearchPage", currentPath);
    localStorage.setItem("lastPageUrl", currentPath); // 确保保存返回页面URL
  } catch (e) {
    console.error("保存播放状态失败:", e);
  }

  // 在当前标签页中打开播放页面
  window.location.href = watchUrl;
}

// 弹出播放器页面
function showVideoPlayer(url) {
  // 在打开播放器前，隐藏详情弹窗
  const detailModal = document.getElementById("modal");
  if (detailModal) {
    detailModal.classList.add("hidden");
  }
  // 临时隐藏搜索结果和豆瓣区域，防止高度超出播放器而出现滚动条
  document.getElementById("resultsArea").classList.add("hidden");
  document.getElementById("doubanArea").classList.add("hidden");
  // 在框架中打开播放页面
  videoPlayerFrame = document.createElement("iframe");
  videoPlayerFrame.id = "VideoPlayerFrame";
  videoPlayerFrame.className = "fixed w-full h-screen z-40";
  videoPlayerFrame.src = url;
  document.body.appendChild(videoPlayerFrame);
  // 将焦点移入iframe
  videoPlayerFrame.focus();
}

// 关闭播放器页面
function closeVideoPlayer(home = false) {
  videoPlayerFrame = document.getElementById("VideoPlayerFrame");
  if (videoPlayerFrame) {
    videoPlayerFrame.remove();
    // 恢复搜索结果显示
    document.getElementById("resultsArea").classList.remove("hidden");
    // 关闭播放器时也隐藏详情弹窗
    const detailModal = document.getElementById("modal");
    if (detailModal) {
      detailModal.classList.add("hidden");
    }
    // 如果启用豆瓣区域则显示豆瓣区域
    if (localStorage.getItem("doubanEnabled") === "true") {
      document.getElementById("doubanArea").classList.remove("hidden");
    }
  }
  if (home) {
    // 刷新主页
    window.location.href = "/";
  }
}

// 播放上一集
function playPreviousEpisode(sourceCode) {
  if (currentEpisodeIndex > 0) {
    const prevIndex = currentEpisodeIndex - 1;
    const prevUrl = currentEpisodes[prevIndex];
    playVideo(prevUrl, currentVideoTitle, sourceCode, prevIndex);
  }
}

// 播放下一集
function playNextEpisode(sourceCode) {
  if (currentEpisodeIndex < currentEpisodes.length - 1) {
    const nextIndex = currentEpisodeIndex + 1;
    const nextUrl = currentEpisodes[nextIndex];
    playVideo(nextUrl, currentVideoTitle, sourceCode, nextIndex);
  }
}

// 处理播放器加载错误
function handlePlayerError() {
  hideLoading();
  showToast("视频播放加载失败，请尝试其他视频源", "error");
}

// 辅助函数用于渲染剧集按钮（使用当前的排序状态）
function renderEpisodes(vodName, sourceCode, vodId) {
  const episodes = episodesReversed
    ? [...currentEpisodes].reverse()
    : currentEpisodes;
  return episodes
    .map((episode, index) => {
      // 根据倒序状态计算真实的剧集索引
      const realIndex = episodesReversed
        ? currentEpisodes.length - 1 - index
        : index;
      return `            <button id="episode-${realIndex}" onclick="playVideo('${episode}','${vodName.replace(
        /"/g,
        "&quot;"
      )}', '${sourceCode}', ${realIndex}, '${vodId}')" 
                    class="px-4 py-2 bg-[#222] hover:bg-[#333] border border-[#333] rounded-lg transition-colors text-center episode-btn">
                ${realIndex + 1}
            </button>
        `;
    })
    .join("");
}

// 复制视频链接到剪贴板
function copyLinks() {
  const episodes = episodesReversed
    ? [...currentEpisodes].reverse()
    : currentEpisodes;
  const linkList = episodes.join("\r\n");
  navigator.clipboard
    .writeText(linkList)
    .then(() => {
      showToast("播放链接已复制", "success");
    })
    .catch((err) => {
      showToast("复制失败，请检查浏览器权限", "error");
    });
}

// 切换排序状态的函数
function toggleEpisodeOrder(sourceCode, vodId) {
  episodesReversed = !episodesReversed;
  // 重新渲染剧集区域，使用 currentVideoTitle 作为视频标题
  const episodesGrid = document.getElementById("episodesGrid");
  if (episodesGrid) {
    episodesGrid.innerHTML = renderEpisodes(
      currentVideoTitle,
      sourceCode,
      vodId
    );
  }

  // 更新按钮文本和箭头方向
  const toggleBtn = document.querySelector(
    `button[onclick="toggleEpisodeOrder('${sourceCode}', '${vodId}')"]`
  );
  if (toggleBtn) {
    toggleBtn.querySelector("span").textContent = episodesReversed
      ? "正序排列"
      : "倒序排列";
    const arrowIcon = toggleBtn.querySelector("svg");
    if (arrowIcon) {
      arrowIcon.style.transform = episodesReversed
        ? "rotate(180deg)"
        : "rotate(0deg)";
    }
  }
}

// 从URL导入配置
async function importConfigFromUrl() {
  // 创建模态框元素
  let modal = document.getElementById("importUrlModal");
  if (modal) {
    document.body.removeChild(modal);
  }

  modal = document.createElement("div");
  modal.id = "importUrlModal";
  modal.className =
    "fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-40";

  modal.innerHTML = `
        <div class="bg-[#191919] rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto relative">
            <button id="closeUrlModal" class="absolute top-4 right-4 text-gray-400 hover:text-white text-xl">&times;</button>
            
            <h3 class="text-xl font-bold mb-4">从URL导入配置</h3>
            
            <div class="mb-4">
                <input type="text" id="configUrl" placeholder="输入配置文件URL" 
                       class="w-full px-3 py-2 bg-[#222] border border-[#333] rounded-lg text-white focus:outline-none focus:ring-1 focus:ring-blue-500">
            </div>
            
            <div class="flex justify-end space-x-2">
                <button id="confirmUrlImport" class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">导入</button>
                <button id="cancelUrlImport" class="bg-[#444] hover:bg-[#555] text-white px-4 py-2 rounded">取消</button>
            </div>
        </div>`;

  document.body.appendChild(modal);

  // 关闭按钮事件
  document.getElementById("closeUrlModal").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // 取消按钮事件
  document.getElementById("cancelUrlImport").addEventListener("click", () => {
    document.body.removeChild(modal);
  });

  // 确认导入按钮事件
  document
    .getElementById("confirmUrlImport")
    .addEventListener("click", async () => {
      const url = document.getElementById("configUrl").value.trim();
      if (!url) {
        showToast("请输入配置文件URL", "warning");
        return;
      }

      // 验证URL格式
      try {
        const urlObj = new URL(url);
        if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
          showToast("URL必须以http://或https://开头", "warning");
          return;
        }
      } catch (e) {
        showToast("URL格式不正确", "warning");
        return;
      }

      showLoading("正在从URL导入配置...");

      try {
        // 获取配置文件 - 直接请求URL
        const response = await fetch(url, {
          mode: "cors",
          headers: {
            Accept: "application/json",
          },
        });
        if (!response.ok) throw "获取配置文件失败";

        // 验证响应内容类型
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
          throw "响应不是有效的JSON格式";
        }

        const config = await response.json();
        if (config.name !== "LibreTV-Settings") throw "配置文件格式不正确";

        // 验证哈希
        const dataHash = await sha256(JSON.stringify(config.data));
        if (dataHash !== config.hash) throw "配置文件哈希值不匹配";

        // 导入配置
        for (let item in config.data) {
          localStorage.setItem(item, config.data[item]);
        }

        showToast("配置文件导入成功，3 秒后自动刷新本页面。", "success");
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } catch (error) {
        const message = typeof error === "string" ? error : "导入配置失败";
        showToast(`从URL导入配置出错 (${message})`, "error");
      } finally {
        hideLoading();
        document.body.removeChild(modal);
      }
    });

  // 点击模态框外部关闭
  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// 配置文件导入功能
async function importConfig() {
  showImportBox(async (file) => {
    try {
      // 检查文件类型
      if (!(file.type === "application/json" || file.name.endsWith(".json")))
        throw "文件类型不正确";

      // 检查文件大小
      if (file.size > 1024 * 1024 * 10) throw new Error("文件大小超过 10MB");

      // 读取文件内容
      const content = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject("文件读取失败");
        reader.readAsText(file);
      });

      // 解析并验证配置
      const config = JSON.parse(content);
      if (config.name !== "LibreTV-Settings") throw "配置文件格式不正确";

      // 验证哈希
      const dataHash = await sha256(JSON.stringify(config.data));
      if (dataHash !== config.hash) throw "配置文件哈希值不匹配";

      // 导入配置
      for (let item in config.data) {
        localStorage.setItem(item, config.data[item]);
      }

      showToast("配置文件导入成功，3 秒后自动刷新本页面。", "success");
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      const message = typeof error === "string" ? error : "配置文件格式错误";
      showToast(`配置文件读取出错 (${message})`, "error");
    }
  });
}

// 配置文件导出功能
async function exportConfig() {
  // 存储配置数据
  const config = {};
  const items = {};

  const settingsToExport = [
    "selectedAPIs",
    "customAPIs",
    "yellowFilterEnabled",
    "adFilteringEnabled",
    "doubanEnabled",
    "hasInitializedDefaults",
    "searchBatchSize",
  ];

  // 导出设置项
  settingsToExport.forEach((key) => {
    const value = localStorage.getItem(key);
    if (value !== null) {
      items[key] = value;
    }
  });

  // 导出历史记录
  const viewingHistory = localStorage.getItem("viewingHistory");
  if (viewingHistory) {
    items["viewingHistory"] = viewingHistory;
  }

  const searchHistory = localStorage.getItem(SEARCH_HISTORY_KEY);
  if (searchHistory) {
    items[SEARCH_HISTORY_KEY] = searchHistory;
  }

  const times = Date.now().toString();
  config["name"] = "LibreTV-Settings"; // 配置文件名，用于校验
  config["time"] = times; // 配置文件生成时间
  config["cfgVer"] = "1.0.0"; // 配置文件版本
  config["data"] = items; // 配置文件数据
  config["hash"] = await sha256(JSON.stringify(config["data"])); // 计算数据的哈希值，用于校验

  // 将配置数据保存为 JSON 文件
  saveStringAsFile(
    JSON.stringify(config),
    "LibreTV-Settings_" + times + ".json"
  );
}

// 将字符串保存为文件
function saveStringAsFile(content, fileName) {
  // 创建Blob对象并指定类型
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  // 生成临时URL
  const url = window.URL.createObjectURL(blob);
  // 创建<a>标签并触发下载
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  // 清理临时对象
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

// 移除Node.js的require语句，因为这是在浏览器环境中运行的

// 智能URL更新函数
function updateSearchURL(query, status) {
  try {
    const encodedQuery = encodeURIComponent(query);
    const title = status === "partial" ? `搜索中: ${query}` : `搜索: ${query}`;

    window.history.pushState(
      { search: query, status: status },
      `${title} - LibreTV`,
      `/s=${encodedQuery}`
    );
    document.title = `${title} - LibreTV`;
  } catch (e) {
    console.error("更新URL失败:", e);
  }
}

// 显示缓存的搜索结果
function displayCachedResults(cachedData, query) {
  // 设置搜索状态为非活跃（缓存表示搜索已完成）
  window.isSearchActive = false;
  window.currentSearchQuery = query;

  // 更新搜索框
  document.getElementById("searchInput").value = query;

  // 显示结果区域
  document.getElementById("searchArea").classList.remove("flex-1");
  document.getElementById("searchArea").classList.add("mb-8");
  document.getElementById("resultsArea").classList.remove("hidden");

  // 隐藏豆瓣推荐区域
  const doubanArea = document.getElementById("doubanArea");
  if (doubanArea) {
    doubanArea.classList.add("hidden");
  }

  // 直接显示缓存的结果
  const resultsDiv = document.getElementById("results");

  // 确保加载动画已隐藏
  const loading = document.getElementById("loading");
  if (loading) {
    loading.style.display = "none";
  }

  // 直接使用缓存的HTML，避免重新排序和过滤
  if (cachedData.html) {
    resultsDiv.innerHTML = cachedData.html;
  } else {
    // 兼容旧格式缓存数据
    let filteredResults = cachedData.results;
    const yellowFilterEnabled =
      localStorage.getItem("yellowFilterEnabled") === "true";
    if (yellowFilterEnabled) {
      const banned = [
        "伦理片",
        "福利",
        "里番动漫",
        "门事件",
        "萝莉少女",
        "制服诱惑",
        "国产传媒",
        "cosplay",
        "黑丝诱惑",
        "无码",
        "日本无码",
        "有码",
        "日本有码",
        "SWAG",
        "网红主播",
        "色情片",
        "同性片",
        "福利视频",
        "福利片",
      ];
      filteredResults = filteredResults.filter((item) => {
        const typeName = item.type_name || "";
        return !banned.some((keyword) => typeName.includes(keyword));
      });
    }

    // 对缓存结果应用智能排序，确保显示效果一致
    const searchQuery = query.toLowerCase();

    // 计算相关性分数并过滤
    const getRelevanceScore = (title, remarks) => {
      let score = 0;
      let relevanceLevel = 0; // 0=无关, 1=低相关, 2=中相关, 3=高相关

      // 标题完全匹配 +200分（最高优先级）
      if (title === searchQuery) {
        score += 200;
        relevanceLevel = 3;
        return { score, relevanceLevel }; // 完全匹配直接返回最高分
      }

      // 标题以搜索词开头 +100分
      if (title.startsWith(searchQuery)) {
        score += 100;
        relevanceLevel = 3;
      }

      // 标题包含完整搜索词 +80分
      if (title.includes(searchQuery)) {
        score += 80;
        relevanceLevel = Math.max(relevanceLevel, 2);
      }

      // 分词匹配（更精确的分词）
      const queryWords = searchQuery
        .split(/[\s,，、]+/)
        .filter((w) => w.length > 1);
      let matchedWords = 0;
      let totalWords = queryWords.length;

      queryWords.forEach((word) => {
        if (title.includes(word)) {
          matchedWords++;
          // 根据匹配位置给分
          if (title.indexOf(word) === 0) {
            score += 30; // 开头匹配
            relevanceLevel = Math.max(relevanceLevel, 2);
          } else {
            score += 15; // 中间匹配
            relevanceLevel = Math.max(relevanceLevel, 1);
          }
        }
      });

      // 如果所有词都匹配，额外加分
      if (matchedWords === totalWords && totalWords > 0) {
        score += 50;
        relevanceLevel = Math.max(relevanceLevel, 2);
      }

      // 简介匹配（权重较低）
      if (remarks.includes(searchQuery)) {
        score += 10;
        relevanceLevel = Math.max(relevanceLevel, 1);
      }

      queryWords.forEach((word) => {
        if (remarks.includes(word)) {
          score += 2;
          relevanceLevel = Math.max(relevanceLevel, 1);
        }
      });

      return { score, relevanceLevel };
    };

    // 过滤和评分
    const scoredResults = filteredResults.map((item) => {
      const aName = (item.vod_name || "").toLowerCase();
      const aRemarks = (item.vod_remarks || "").toLowerCase();
      const { score, relevanceLevel } = getRelevanceScore(aName, aRemarks);

      return {
        ...item,
        relevanceScore: score,
        relevanceLevel: relevanceLevel,
      };
    });

    // 智能过滤：只保留相关结果
    const relevantResults = scoredResults.filter((item) => {
      // 保留高相关和中相关的结果
      if (item.relevanceLevel >= 2) return true;

      // 对于低相关结果，需要满足额外条件
      if (item.relevanceLevel === 1) {
        // 检查是否有足够的匹配词
        const queryWords = searchQuery
          .split(/[\s,，、]+/)
          .filter((w) => w.length > 1);
        const title = (item.vod_name || "").toLowerCase();
        const remarks = (item.vod_remarks || "").toLowerCase();

        // 至少匹配50%的关键词，或者简介中有完整匹配
        const matchedWords = queryWords.filter(
          (word) => title.includes(word) || remarks.includes(word)
        ).length;

        return (
          matchedWords >= Math.ceil(queryWords.length * 0.5) ||
          remarks.includes(searchQuery)
        );
      }

      return false; // 过滤掉无关结果
    });

    // 按相关性分数排序
    relevantResults.sort((a, b) => {
      // 首先按相关性等级排序
      if (a.relevanceLevel !== b.relevanceLevel) {
        return b.relevanceLevel - a.relevanceLevel;
      }

      // 然后按分数排序
      if (a.relevanceScore !== b.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }

      // 如果分数相同，按标题长度排序（短的在前，通常更精确）
      const aNameLength = (a.vod_name || "").length;
      const bNameLength = (b.vod_name || "").length;
      if (aNameLength !== bNameLength) {
        return aNameLength - bNameLength;
      }

      // 如果标题长度也相同，按来源排序
      return (a.source_name || "").localeCompare(b.source_name || "");
    });

    // 更新filteredResults为智能排序后的结果
    filteredResults = relevantResults.map((item) => {
      // 移除临时添加的评分字段
      const { relevanceScore, relevanceLevel, ...cleanItem } = item;
      return cleanItem;
    });

    // 渲染结果
    const safeResults = filteredResults
      .map((item) => {
        const safeId = item.vod_id
          ? item.vod_id.toString().replace(/[^\w-]/g, "")
          : "";
        const safeName = (item.vod_name || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const safeRemarks = (item.vod_remarks || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const safePic = (item.vod_pic || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const safeYear = (item.vod_year || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const safeArea = (item.vod_area || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const safeLang = (item.vod_lang || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const safeSourceCode = (item.source_code || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");
        const safeSourceName = (item.source_name || "")
          .toString()
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;");

        const sourceInfo = safeSourceName
          ? `<span class="text-xs text-gray-400">来源: ${safeSourceName}</span>`
          : "";

        return `
        <div class="bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group cursor-pointer"
             onclick="showDetails('${safeId}', '${safeName.replace(
          /'/g,
          "\\'"
        )}', '${safeSourceCode}')">
          <div class="relative">
            <img src="${safePic || "image/nomedia.png"}" 
                 alt="${safeName}" 
                 class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                 onerror="this.src='image/nomedia.png'">
            <div class="absolute top-2 left-2 flex flex-wrap gap-1">
              ${
                (item.type_name || "").toString().replace(/</g, "&lt;")
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
                ${(item.type_name || "")
                  .toString()
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")}
              </span>`
                  : ""
              }
            </div>
          </div>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
              ${safeName}
            </h3>
            <p class="text-sm text-gray-400 mb-3 line-clamp-2">
              ${safeRemarks || "暂无简介"}
            </p>
            <div class="flex flex-wrap gap-1 mb-2">
              ${
                safeYear
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeYear}</span>`
                  : ""
              }
              ${
                safeArea
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeArea}</span>`
                  : ""
              }
              ${
                safeLang
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeLang}</span>`
                  : ""
              }
            </div>
            
            <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
              ${sourceInfo ? `<div>${sourceInfo}</div>` : "<div></div>"}
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    // 添加搜索完成提示
    const completionText = `
      <div class="col-span-full text-center py-4 text-sm text-green-400">
        <div class="flex items-center justify-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
          <span>搜索已完成 - 共找到 ${filteredResults.length} 个结果</span>
        </div>
      </div>
    `;

    resultsDiv.innerHTML = safeResults + completionText;
  }

  // 更新搜索结果计数
  const searchResultsCount = document.getElementById("searchResultsCount");
  if (searchResultsCount) {
    searchResultsCount.textContent =
      cachedData.resultsCount ||
      (cachedData.results ? cachedData.results.length : 0);
  }

  // 更新URL状态
  updateSearchURL(query, "complete");
}

// 显示搜索中状态
function showSearchingState(query) {
  // 更新搜索框
  document.getElementById("searchInput").value = query;

  // 显示搜索中界面
  document.getElementById("searchArea").classList.remove("flex-1");
  document.getElementById("searchArea").classList.add("mb-8");
  document.getElementById("resultsArea").classList.remove("hidden");

  // 隐藏豆瓣推荐区域
  const doubanArea = document.getElementById("doubanArea");
  if (doubanArea) {
    doubanArea.classList.add("hidden");
  }

  // 显示搜索中提示
  document.getElementById("results").innerHTML = `
    <div class="col-span-full text-center py-16">
      <div class="flex items-center justify-center gap-2 mb-4">
        <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
        <span class="text-lg font-medium text-gray-400">正在搜索...</span>
      </div>
      <p class="text-sm text-gray-500">搜索关键词: ${query}</p>
    </div>
  `;

  // 更新URL状态
  updateSearchURL(query, "searching");
}

// 渐进式显示搜索结果
function displayProgressiveResults(results, currentStage, totalStages, query) {
  // 检查搜索是否被取消
  if (
    window.currentSearchAbortController &&
    window.currentSearchAbortController.signal.aborted
  ) {
    return;
  }

  // 检查搜索状态是否有效
  if (!window.isSearchActive) {
    return;
  }

  // 检查搜索ID是否匹配
  if (
    window.currentSearchId &&
    window.currentSearchId !== window.currentSearchId
  ) {
    return;
  }

  // 检查搜索关键词是否匹配
  if (window.currentSearchQuery && window.currentSearchQuery !== query) {
    return;
  }

  // 第一个API有结果时立即更新URL
  if (currentStage === 1 && results && results.length > 0) {
    updateSearchURL(query, "partial");
  }

  // 移除渐进式搜索时的缓存逻辑，只在搜索完成时缓存
  // 显示结果区域
  document.getElementById("searchArea").classList.remove("flex-1");
  document.getElementById("searchArea").classList.add("mb-8");
  document.getElementById("resultsArea").classList.remove("hidden");

  // 隐藏豆瓣推荐区域
  const doubanArea = document.getElementById("doubanArea");
  if (doubanArea) {
    doubanArea.classList.add("hidden");
  }

  const resultsDiv = document.getElementById("results");

  // 如果没有结果
  if (!results || results.length === 0) {
    // 如果还在搜索中，显示搜索状态
    if (currentStage < totalStages) {
      resultsDiv.innerHTML = `
        <div class="col-span-full text-center py-16">
          <div class="flex items-center justify-center gap-2 mb-4">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            <span class="text-lg font-medium text-gray-400">正在搜索更多结果...</span>
          </div>
          <p class="text-sm text-gray-500">已搜索 ${currentStage}/${totalStages} 个数据源（并行批次搜索），正在继续搜索</p>
        </div>
      `;
    } else {
      // 最终确认没有结果
      resultsDiv.innerHTML = `
        <div class="col-span-full text-center py-16">
          <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
          <p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p>
        </div>
      `;
    }
    return;
  }

  // 简单的相关性排序（用于渐进式显示）
  const sortedResults = results.sort((a, b) => {
    const aName = (a.vod_name || "").toLowerCase();
    const bName = (b.vod_name || "").toLowerCase();
    const queryLower = query.toLowerCase();

    // 标题完全匹配优先
    if (aName === queryLower && bName !== queryLower) return -1;
    if (bName === queryLower && aName !== queryLower) return 1;

    // 标题包含搜索词优先
    if (aName.includes(queryLower) && !bName.includes(queryLower)) return -1;
    if (bName.includes(queryLower) && !aName.includes(queryLower)) return 1;

    // 按标题长度排序
    return aName.length - bName.length;
  });

  // 渲染结果
  const safeResults = sortedResults
    .map((item) => {
      const safeId = item.vod_id
        ? item.vod_id.toString().replace(/[^\w-]/g, "")
        : "";
      const safeName = (item.vod_name || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeRemarks = (item.vod_remarks || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safePic = (item.vod_pic || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeYear = (item.vod_year || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeArea = (item.vod_area || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeLang = (item.vod_lang || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeSourceCode = (item.source_code || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeSourceName = (item.source_name || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      // 构建播放源信息
      const sourceInfo = safeSourceName
        ? `<span class="text-xs text-gray-400">来源: ${safeSourceName}</span>`
        : "";

      return `
        <div class="bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group cursor-pointer"
             onclick="showDetails('${safeId}', '${safeName.replace(
        /'/g,
        "\\'"
      )}', '${safeSourceCode}')">
          <div class="relative">
            <img src="${safePic || "image/nomedia.png"}" 
                 alt="${safeName}" 
                 class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                 onerror="this.src='image/nomedia.png'">
            <div class="absolute top-2 left-2 flex flex-wrap gap-1">
              ${
                (item.type_name || "").toString().replace(/</g, "&lt;")
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
                    ${(item.type_name || "")
                      .toString()
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")}
                  </span>`
                  : ""
              }
            </div>
          </div>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
              ${safeName}
            </h3>
            <p class="text-sm text-gray-400 mb-3 line-clamp-2">
              ${safeRemarks || "暂无简介"}
            </p>
            <div class="flex flex-wrap gap-1 mb-2">
              ${
                safeYear
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeYear}</span>`
                  : ""
              }
              ${
                safeArea
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeArea}</span>`
                  : ""
              }
              ${
                safeLang
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeLang}</span>`
                  : ""
              }
            </div>
            
            <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
              ${sourceInfo ? `<div>${sourceInfo}</div>` : "<div></div>"}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  // 实时更新缓存 - 每次有新结果时都更新
  const topSources = sortedResults.slice(0, 15);
  localStorage.setItem(
    "quickSwitchSources",
    JSON.stringify({
      query: query,
      sources: topSources,
      timestamp: Date.now(),
      isComplete: false, // 标记搜索是否完成
      progress: `${currentStage}/${totalStages}`, // 显示搜索进度
    })
  );

  // 添加进度提示
  let progressText = "";
  if (currentStage < totalStages) {
    progressText = `<div class="col-span-full text-center py-4 text-sm text-gray-400">
       <div class="flex items-center justify-center gap-2">
         <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
         <span>正在搜索更多结果... (${currentStage}/${totalStages} 并行批次)</span>
       </div>
     </div>`;
  }

  resultsDiv.innerHTML = safeResults + progressText;

  // 更新搜索结果计数
  const searchResultsCount = document.getElementById("searchResultsCount");
  if (searchResultsCount) {
    searchResultsCount.textContent = results.length;
  }
}

// 最终处理和显示结果
function processAndDisplayFinalResults(allResults, query) {
  // 检查搜索状态是否有效
  if (!window.isSearchActive) {
    return;
  }

  // 检查搜索ID是否匹配
  if (
    window.currentSearchId &&
    window.currentSearchId !== window.currentSearchId
  ) {
    return;
  }

  // 检查搜索关键词是否匹配
  if (window.currentSearchQuery && window.currentSearchQuery !== query) {
    return;
  }
  // 智能相关性排序和过滤：只显示相关结果
  const searchQuery = query.toLowerCase();

  // 计算相关性分数并过滤
  const getRelevanceScore = (title, remarks) => {
    let score = 0;
    let relevanceLevel = 0; // 0=无关, 1=低相关, 2=中相关, 3=高相关

    // 标题完全匹配 +200分（最高优先级）
    if (title === searchQuery) {
      score += 200;
      relevanceLevel = 3;
      return { score, relevanceLevel }; // 完全匹配直接返回最高分
    }

    // 标题以搜索词开头 +100分
    if (title.startsWith(searchQuery)) {
      score += 100;
      relevanceLevel = 3;
    }

    // 标题包含完整搜索词 +80分
    if (title.includes(searchQuery)) {
      score += 80;
      relevanceLevel = Math.max(relevanceLevel, 2);
    }

    // 分词匹配（更精确的分词）
    const queryWords = searchQuery
      .split(/[\s,，、]+/)
      .filter((w) => w.length > 1);
    let matchedWords = 0;
    let totalWords = queryWords.length;

    queryWords.forEach((word) => {
      if (title.includes(word)) {
        matchedWords++;
        // 根据匹配位置给分
        if (title.indexOf(word) === 0) {
          score += 30; // 开头匹配
          relevanceLevel = Math.max(relevanceLevel, 2);
        } else {
          score += 15; // 中间匹配
          relevanceLevel = Math.max(relevanceLevel, 1);
        }
      }
    });

    // 如果所有词都匹配，额外加分
    if (matchedWords === totalWords && totalWords > 0) {
      score += 50;
      relevanceLevel = Math.max(relevanceLevel, 2);
    }

    // 简介匹配（权重较低）
    if (remarks.includes(searchQuery)) {
      score += 10;
      relevanceLevel = Math.max(relevanceLevel, 1);
    }

    queryWords.forEach((word) => {
      if (remarks.includes(word)) {
        score += 2;
        relevanceLevel = Math.max(relevanceLevel, 1);
      }
    });

    return { score, relevanceLevel };
  };

  // 过滤和评分
  const scoredResults = allResults.map((item) => {
    const aName = (item.vod_name || "").toLowerCase();
    const aRemarks = (item.vod_remarks || "").toLowerCase();
    const { score, relevanceLevel } = getRelevanceScore(aName, aRemarks);

    return {
      ...item,
      relevanceScore: score,
      relevanceLevel: relevanceLevel,
    };
  });

  // 智能过滤：只保留相关结果
  const relevantResults = scoredResults.filter((item) => {
    // 保留高相关和中相关的结果
    if (item.relevanceLevel >= 2) return true;

    // 对于低相关结果，需要满足额外条件
    if (item.relevanceLevel === 1) {
      // 检查是否有足够的匹配词
      const queryWords = searchQuery
        .split(/[\s,，、]+/)
        .filter((w) => w.length > 1);
      const title = (item.vod_name || "").toLowerCase();
      const remarks = (item.vod_remarks || "").toLowerCase();

      // 至少匹配50%的关键词，或者简介中有完整匹配
      const matchedWords = queryWords.filter(
        (word) => title.includes(word) || remarks.includes(word)
      ).length;

      return (
        matchedWords >= Math.ceil(queryWords.length * 0.5) ||
        remarks.includes(searchQuery)
      );
    }

    return false; // 过滤掉无关结果
  });

  // 按相关性分数排序
  relevantResults.sort((a, b) => {
    // 首先按相关性等级排序
    if (a.relevanceLevel !== b.relevanceLevel) {
      return b.relevanceLevel - a.relevanceLevel;
    }

    // 然后按分数排序
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }

    // 如果分数相同，按标题长度排序（短的在前，通常更精确）
    const aNameLength = (a.vod_name || "").length;
    const bNameLength = (b.vod_name || "").length;
    if (aNameLength !== bNameLength) {
      return aNameLength - bNameLength;
    }

    // 如果标题长度也相同，按来源排序
    return (a.source_name || "").localeCompare(b.source_name || "");
  });

  // 更新allResults为过滤后的结果
  allResults = relevantResults.map((item) => {
    // 移除临时添加的评分字段
    const { relevanceScore, relevanceLevel, ...cleanItem } = item;
    return cleanItem;
  });

  // 保存前15个最匹配的源用于快速切换，并标记搜索完成
  const topSources = allResults.slice(0, 15);
  localStorage.setItem(
    "quickSwitchSources",
    JSON.stringify({
      query: query,
      sources: topSources,
      timestamp: Date.now(),
      isComplete: true, // 标记搜索已完成
      progress: "完成", // 显示搜索完成状态
    })
  );

  // 保存搜索结果缓存，用于返回时直接显示
  const cacheKey = `searchResults_${query}`;

  // 渲染最终结果HTML用于缓存
  const finalSafeResults = allResults
    .map((item) => {
      const safeId = item.vod_id
        ? item.vod_id.toString().replace(/[^\w-]/g, "")
        : "";
      const safeName = (item.vod_name || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeRemarks = (item.vod_remarks || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safePic = (item.vod_pic || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeYear = (item.vod_year || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeArea = (item.vod_area || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeLang = (item.vod_lang || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeSourceCode = (item.source_code || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeSourceName = (item.source_name || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      const sourceInfo = safeSourceName
        ? `<span class="text-xs text-gray-400">来源: ${safeSourceName}</span>`
        : "";

      return `
      <div class="bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group cursor-pointer"
           onclick="showDetails('${safeId}', '${safeName.replace(
        /'/g,
        "\\'"
      )}', '${safeSourceCode}')">
        <div class="relative">
          <img src="${safePic || "image/nomedia.png"}" 
               alt="${safeName}" 
               class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
               onerror="this.src='image/nomedia.png'">
          <div class="absolute top-2 left-2 flex flex-wrap gap-1">
            ${
              (item.type_name || "").toString().replace(/</g, "&lt;")
                ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
              ${(item.type_name || "")
                .toString()
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")}
            </span>`
                : ""
            }
          </div>
        </div>
        <div class="p-4">
          <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
            ${safeName}
          </h3>
          <p class="text-sm text-gray-400 mb-3 line-clamp-2">
            ${safeRemarks || "暂无简介"}
          </p>
          <div class="flex flex-wrap gap-1 mb-2">
            ${
              safeYear
                ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeYear}</span>`
                : ""
            }
            ${
              safeArea
                ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeArea}</span>`
                : ""
            }
            ${
              safeLang
                ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeLang}</span>`
                : ""
            }
          </div>
          
          <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
            ${sourceInfo ? `<div>${sourceInfo}</div>` : "<div></div>"}
          </div>
        </div>
      </div>
    `;
    })
    .join("");

  // 添加搜索完成提示
  const completionText = `
    <div class="col-span-full text-center py-4 text-sm text-green-400">
      <div class="flex items-center justify-center gap-2">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        <span>搜索已完成 - 共找到 ${allResults.length} 个结果</span>
      </div>
    </div>
  `;

  const pageHTML = finalSafeResults + completionText;

  const cacheData = {
    html: pageHTML,
    resultsCount: allResults.length,
    timestamp: Date.now(),
    query: query,
  };

  // 搜索完成后保存缓存
  localStorage.setItem(cacheKey, JSON.stringify(cacheData));

  // 更新搜索结果计数
  const searchResultsCount = document.getElementById("searchResultsCount");
  if (searchResultsCount) {
    searchResultsCount.textContent = allResults.length;
  }

  // 显示结果区域，调整搜索区域
  document.getElementById("searchArea").classList.remove("flex-1");
  document.getElementById("searchArea").classList.add("mb-8");
  document.getElementById("resultsArea").classList.remove("hidden");

  // 隐藏豆瓣推荐区域（如果存在）
  const doubanArea = document.getElementById("doubanArea");
  if (doubanArea) {
    doubanArea.classList.add("hidden");
  }

  const resultsDiv = document.getElementById("results");

  // 如果没有结果
  if (!allResults || allResults.length === 0) {
    resultsDiv.innerHTML = `
      <div class="col-span-full text-center py-16">
        <svg class="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" 
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 class="mt-2 text-lg font-medium text-gray-400">没有找到匹配的结果</h3>
        <p class="mt-1 text-sm text-gray-500">请尝试其他关键词或更换数据源</p>
      </div>
    `;
    hideLoading();
    return;
  }

  // 搜索完成时更新URL状态
  updateSearchURL(query, "complete");

  // 处理搜索结果过滤：如果启用了黄色内容过滤，则过滤掉分类含有敏感内容的项目
  const yellowFilterEnabled =
    localStorage.getItem("yellowFilterEnabled") === "true";
  if (yellowFilterEnabled) {
    const banned = [
      "伦理片",
      "福利",
      "里番动漫",
      "门事件",
      "萝莉少女",
      "制服诱惑",
      "国产传媒",
      "cosplay",
      "黑丝诱惑",
      "无码",
      "日本无码",
      "有码",
      "日本有码",
      "SWAG",
      "网红主播",
      "色情片",
      "同性片",
      "福利视频",
      "福利片",
    ];
    allResults = allResults.filter((item) => {
      const typeName = item.type_name || "";
      return !banned.some((keyword) => typeName.includes(keyword));
    });
  }

  // 添加XSS保护，使用textContent和属性转义
  const safeResults = allResults
    .map((item) => {
      const safeId = item.vod_id
        ? item.vod_id.toString().replace(/[^\w-]/g, "")
        : "";
      const safeName = (item.vod_name || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeRemarks = (item.vod_remarks || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safePic = (item.vod_pic || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeYear = (item.vod_year || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeArea = (item.vod_area || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeLang = (item.vod_lang || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeSourceCode = (item.source_code || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
      const safeSourceName = (item.source_name || "")
        .toString()
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");

      // 构建播放源信息
      const sourceInfo = safeSourceName
        ? `<span class="text-xs text-gray-400">来源: ${safeSourceName}</span>`
        : "";

      return `
        <div class="bg-[#1a1a1a] rounded-lg overflow-hidden border border-[#333] hover:border-[#555] transition-all duration-300 hover:shadow-lg hover:shadow-black/20 group cursor-pointer"
             onclick="showDetails('${safeId}', '${safeName.replace(
        /'/g,
        "\\'"
      )}', '${safeSourceCode}')">
          <div class="relative">
            <img src="${safePic || "image/nomedia.png"}" 
                 alt="${safeName}" 
                 class="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                 onerror="this.src='image/nomedia.png'">
            <div class="absolute top-2 left-2 flex flex-wrap gap-1">
              ${
                (item.type_name || "").toString().replace(/</g, "&lt;")
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-opacity-20 bg-blue-500 text-blue-300">
                    ${(item.type_name || "")
                      .toString()
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;")}
                  </span>`
                  : ""
              }
            </div>
          </div>
          <div class="p-4">
            <h3 class="text-lg font-semibold text-white mb-2 line-clamp-2 group-hover:text-blue-400 transition-colors">
              ${safeName}
            </h3>
            <p class="text-sm text-gray-400 mb-3 line-clamp-2">
              ${safeRemarks || "暂无简介"}
            </p>
            <div class="flex flex-wrap gap-1 mb-2">
              ${
                safeYear
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeYear}</span>`
                  : ""
              }
              ${
                safeArea
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeArea}</span>`
                  : ""
              }
              ${
                safeLang
                  ? `<span class="text-xs py-0.5 px-1.5 rounded bg-gray-700 text-gray-300">${safeLang}</span>`
                  : ""
              }
            </div>
            
            <div class="flex justify-between items-center mt-1 pt-1 border-t border-gray-800">
              ${sourceInfo ? `<div>${sourceInfo}</div>` : "<div></div>"}
            </div>
          </div>
        </div>
      `;
    })
    .join("");

  resultsDiv.innerHTML = safeResults;
  hideLoading();
}
