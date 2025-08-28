async function searchByAPIAndKeyWord(apiId, query) {
  try {
    let apiUrl, apiName, apiBaseUrl;

    // 处理自定义API
    if (apiId.startsWith("custom_")) {
      const customIndex = apiId.replace("custom_", "");
      const customApi = getCustomApiInfo(customIndex);
      if (!customApi) return [];

      // 检查自定义API URL是否已经包含完整路径
      const customUrl = customApi.url;
      if (customUrl.includes("/api.php/provide/vod")) {
        // 如果URL已经包含完整路径，直接使用
        apiBaseUrl = customUrl;
        apiUrl =
          apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
      } else {
        // 如果URL是基础域名，添加完整路径
        apiBaseUrl = customUrl;
        apiUrl =
          apiBaseUrl +
          "/api.php/provide/vod" +
          API_CONFIG.search.path +
          encodeURIComponent(query);
      }
      apiName = customApi.name;
    } else {
      // 内置API
      if (!API_SITES[apiId]) return [];
      apiBaseUrl = API_SITES[apiId].api;
      apiUrl = apiBaseUrl + API_CONFIG.search.path + encodeURIComponent(query);
      apiName = API_SITES[apiId].name;
    }

    // 添加URL构建调试信息
    console.log(`[DEBUG] API ${apiId} 基础URL:`, apiBaseUrl);
    console.log(`[DEBUG] API ${apiId} 完整请求URL:`, apiUrl);
    console.log(`[DEBUG] API ${apiId} 搜索关键词:`, query);

    // 添加超时处理
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    // 添加鉴权参数到代理URL
    const proxiedUrl = (await window.ProxyAuth?.addAuthToProxyUrl)
      ? await window.ProxyAuth.addAuthToProxyUrl(
          PROXY_URL + encodeURIComponent(apiUrl)
        )
      : PROXY_URL + encodeURIComponent(apiUrl);

    const response = await fetch(proxiedUrl, {
      headers: API_CONFIG.search.headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(
        `[DEBUG] API ${apiId} 请求失败:`,
        response.status,
        response.statusText
      );
      return [];
    }

    const data = await response.json();

    // 添加响应数据调试信息
    console.log(`[DEBUG] API ${apiId} 响应状态:`, response.status);
    console.log(`[DEBUG] API ${apiId} 响应数据结构:`, {
      hasData: !!data,
      hasList: !!(data && data.list),
      isArray: !!(data && data.list && Array.isArray(data.list)),
      listLength: data && data.list ? data.list.length : 0,
      pageCount: data && data.pagecount ? data.pagecount : 1,
    });

    if (
      !data ||
      !data.list ||
      !Array.isArray(data.list) ||
      data.list.length === 0
    ) {
      console.warn(`[DEBUG] API ${apiId} 响应数据无效或为空:`, data);
      return [];
    }

    // 处理第一页结果
    const results = data.list.map((item) => ({
      ...item,
      source_name: apiName,
      source_code: apiId,
      api_url: apiId.startsWith("custom_")
        ? getCustomApiInfo(apiId.replace("custom_", ""))?.url
        : undefined,
    }));

    // 获取总页数
    const pageCount = data.pagecount || 1;

    // 限制最大获取页数，避免获取过多无关内容
    const maxPagesToFetch = 1; // 每个API源最多获取1页，避免超时
    const pagesToFetch = Math.min(pageCount - 1, maxPagesToFetch - 1);

    // 添加调试信息
    console.log(`[DEBUG] API ${apiId} 第一页结果数量:`, results.length);
    console.log(`[DEBUG] API ${apiId} 总页数:`, pageCount);
    console.log(`[DEBUG] API ${apiId} 将获取额外页数:`, pagesToFetch);

    // 如果有额外页数，获取更多页的结果
    if (pagesToFetch > 0) {
      const additionalPagePromises = [];

      for (let page = 2; page <= pagesToFetch + 1; page++) {
        // 构建分页URL
        let pageUrl;
        if (apiId.startsWith("custom_")) {
          const customUrl = getCustomApiInfo(apiId.replace("custom_", ""))?.url;
          if (customUrl && customUrl.includes("/api.php/provide/vod")) {
            // 如果URL已经包含完整路径，直接使用
            pageUrl =
              customUrl +
              API_CONFIG.search.pagePath
                .replace("{query}", encodeURIComponent(query))
                .replace("{page}", page);
          } else {
            // 如果URL是基础域名，添加完整路径
            pageUrl =
              customUrl +
              "/api.php/provide/vod" +
              API_CONFIG.search.pagePath
                .replace("{query}", encodeURIComponent(query))
                .replace("{page}", page);
          }
        } else {
          // 内置API
          pageUrl =
            apiBaseUrl +
            API_CONFIG.search.pagePath
              .replace("{query}", encodeURIComponent(query))
              .replace("{page}", page);
        }

        // 创建获取额外页的Promise
        const pagePromise = (async () => {
          try {
            const pageController = new AbortController();
            const pageTimeoutId = setTimeout(() => {
              console.warn(`[DEBUG] API ${apiId} 第${page}页请求超时 (15秒)`);
              pageController.abort();
            }, 15000);

            // 添加鉴权参数到代理URL
            const proxiedPageUrl = (await window.ProxyAuth?.addAuthToProxyUrl)
              ? await window.ProxyAuth.addAuthToProxyUrl(
                  PROXY_URL + encodeURIComponent(pageUrl)
                )
              : PROXY_URL + encodeURIComponent(pageUrl);

            const pageResponse = await fetch(proxiedPageUrl, {
              headers: API_CONFIG.search.headers,
              signal: pageController.signal,
            });

            clearTimeout(pageTimeoutId);

            if (!pageResponse.ok) {
              console.warn(
                `[DEBUG] API ${apiId} 第${page}页请求失败:`,
                pageResponse.status,
                pageResponse.statusText
              );
              return [];
            }

            const pageData = await pageResponse.json();

            if (!pageData || !pageData.list || !Array.isArray(pageData.list)) {
              console.warn(
                `[DEBUG] API ${apiId} 第${page}页响应数据无效:`,
                pageData
              );
              return [];
            }

            // 处理当前页结果
            const pageResults = pageData.list.map((item) => ({
              ...item,
              source_name: apiName,
              source_code: apiId,
              api_url: apiId.startsWith("custom_")
                ? getCustomApiInfo(apiId.replace("custom_", ""))?.url
                : undefined,
            }));

            console.log(
              `[DEBUG] API ${apiId} 第${page}页结果数量:`,
              pageResults.length
            );
            return pageResults;
          } catch (error) {
            console.warn(`API ${apiId} 第${page}页搜索失败:`, error);
            return [];
          }
        })();

        additionalPagePromises.push(pagePromise);
      }

      // 等待所有额外页的结果
      const additionalResults = await Promise.all(additionalPagePromises);

      // 合并所有页的结果
      let totalAdditionalResults = 0;
      additionalResults.forEach((pageResults) => {
        if (pageResults.length > 0) {
          results.push(...pageResults);
          totalAdditionalResults += pageResults.length;
        }
      });

      console.log(
        `[DEBUG] API ${apiId} 额外页结果总数:`,
        totalAdditionalResults
      );
    }

    // 添加最终调试信息
    console.log(`[DEBUG] API ${apiId} 最终结果总数:`, results.length);
    console.log(
      `[DEBUG] API ${apiId} 搜索完成 - 成功获取 ${results.length} 个结果`
    );

    return results;
  } catch (error) {
    console.warn(`API ${apiId} 搜索失败:`, error);
    return [];
  }
}
