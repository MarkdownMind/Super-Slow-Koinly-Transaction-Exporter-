(function() {
    const PAGE_COUNT = 25;
    
    // MEGA SLOW settings - adjust these to go even slower if needed
    const MIN_DELAY = 3000;  // 3 seconds minimum between requests
    const MAX_DELAY = 7000;  // 7 seconds maximum between requests
    const EVERY_10_PAGES_DELAY = 15000; // 15 second break every 10 pages
    const PROGRESS_CHECK_INTERVAL = 10; // Log progress every 10 pages

    // Random delay to simulate human behavior
    const randomDelay = (min = MIN_DELAY, max = MAX_DELAY) => {
        return new Promise(resolve => {
            const delay = Math.floor(Math.random() * (max - min + 1)) + min;
            console.log(`Waiting ${(delay/1000).toFixed(1)} seconds...`);
            setTimeout(resolve, delay);
        });
    }

    const getCookie = (name) => {
        const cookies = document.cookie.split('; ');
        const cookieMap = cookies.map(it => it.split('='))
            .reduce((prev, curr) => {
                const [key, value] = curr;
                return {
                    ...prev,
                    [key]: value,
                }
            }, {})
        return cookieMap[name]
    }

    const fetchHeaders = () => {
        const headers = new Headers();
        headers.append('authority', 'api.koinly.io');
        headers.append('accept', 'application/json, text/plain, */*');
        headers.append('accept-language', 'en-GB,en-US;q=0.9,en;q=0.8');
        headers.append('access-control-allow-credentials', 'true');
        headers.append('caches-requests', '1');
        headers.append('cookie', document.cookie);
        headers.append('origin', 'https://app.koinly.io');
        headers.append('referer', 'https://app.koinly.io/');
        headers.append('sec-fetch-dest', 'empty');
        headers.append('sec-fetch-mode', 'cors');
        headers.append('sec-fetch-site', 'same-site');
        headers.append('sec-gpc', '1');
        headers.append('user-agent', navigator.userAgent);
        headers.append('x-auth-token', getCookie('API_KEY'));
        headers.append('x-portfolio-token', getCookie('PORTFOLIO_ID'));
        return headers;
    }

    const fetchSession = async () => {
        const requestOptions = {
            method: 'GET',
            headers: fetchHeaders(),
            redirect: 'follow'
        };
        
        try {
            console.log('Fetching session...');
            const response = await fetch('https://api.koinly.io/api/sessions', requestOptions);
            return response.json();
        } catch(err) {
            console.error(err)
            throw new Error('Fetch session failed')
        }
    }

    const fetchPage = async (pageNumber, totalPages) => {
        const requestOptions = {
            method: 'GET',
            headers: fetchHeaders(),
            redirect: 'follow'
        };
        
        try {
            console.log(`\n📄 Fetching page ${pageNumber} of ${totalPages} (${((pageNumber/totalPages)*100).toFixed(1)}% complete)`);
            const response = await fetch(`https://api.koinly.io/api/transactions?per_page=${PAGE_COUNT}&order=date&page=${pageNumber}`, requestOptions);
            const data = await response.json();
            console.log(`✅ Page ${pageNumber} fetched successfully (${data.transactions.length} transactions)`);
            return data;
        } catch(err) {
            console.error(err)
            throw new Error(`Fetch failed for page=${pageNumber}`)
        }
    }

    const getAllTransactions = async () => {
        console.log('Fetching first page to determine total pages...');
        const firstPage = await fetchPage(1, '?');
        const totalPages = firstPage.meta.page.total_pages;
        const estimatedTransactions = totalPages * PAGE_COUNT;
        const estimatedTimeMinutes = ((totalPages * ((MIN_DELAY + MAX_DELAY) / 2)) / 60000).toFixed(1);
        
        console.log(`\n🚀 Starting MEGA SLOW export:`);
        console.log(`   Total pages: ${totalPages}`);
        console.log(`   Estimated transactions: ~${estimatedTransactions}`);
        console.log(`   Estimated time: ~${estimatedTimeMinutes} minutes`);
        console.log(`   Delay between requests: ${MIN_DELAY/1000}-${MAX_DELAY/1000} seconds`);
        console.log(`\n⏳ This will take a while - don't close this tab!\n`);
        
        const allPages = [firstPage];
        
        // Fetch remaining pages ONE AT A TIME
        for (let i = 2; i <= totalPages; i++) {
            // Wait before fetching next page
            await randomDelay();
            
            const page = await fetchPage(i, totalPages);
            allPages.push(page);
            
            // Extra long pause every 10 pages
            if (i % PROGRESS_CHECK_INTERVAL === 0 && i < totalPages) {
                const transactionsSoFar = allPages.flatMap(p => p.transactions).length;
                console.log(`\n🎯 PROGRESS CHECK: ${i}/${totalPages} pages complete (${transactionsSoFar} transactions collected)`);
                console.log(`⏸️  Taking a ${EVERY_10_PAGES_DELAY/1000} second break...\n`);
                await new Promise(resolve => setTimeout(resolve, EVERY_10_PAGES_DELAY));
            }
        }
        
        const allTransactions = allPages.flatMap(it => it.transactions);
        console.log(`\n🎉 ALL DONE! Collected ${allTransactions.length} transactions from ${totalPages} pages`);
        return allTransactions;
    }

    const toCSVFile = (baseCurrency, transactions) => {  
   
        // Headings
        const headings = [
           'Date',
           'Sent Amount',
           'Sent Currency',
           'Received Amount',
           'Received Currency',
           'Fee Amount',
           'Fee Currency',
           'Net Worth Amount',
           'Net Worth Currency',
           'Label',
           'Description',
           'TxHash',
        ]
        
        transactionRows = transactions.map((t) => { 
           const row = [
               t.date,
               t.from ? t.from.amount : '',
               t.from ? t.from.currency.symbol : '',
               t.to ? t.to.amount : '',
               t.to ? t.to.currency.symbol : '',
               t.fee ? t.fee.amount : '',
               t.fee ? t.fee.currency.symbol : '',
               t.net_value,
               baseCurrency,
               t.type,
               t.description,
               t.txhash,
           ]
           return row.join(',');  
        });
   
        const csv = [
            headings.join(','), 
            ...transactionRows
        ].join('\n');
         
        const hiddenElement = document.createElement('a');
        hiddenElement.href = 'data:text/csv;charset=utf-8,' + encodeURI(csv);
        hiddenElement.target = '_blank';
        hiddenElement.download = 'Koinly Transactions.csv';
        hiddenElement.click();
        
        console.log('💾 CSV file downloaded!');
    }

    const run = async () => {
        console.log('🐌 Starting MEGA SLOW Koinly export...\n');
        const session = await fetchSession()
        const baseCurrency = session.portfolios[0].base_currency.symbol;
        const transactions = await getAllTransactions()
        console.log('\nYour Koinly Transactions:\n', transactions)
        toCSVFile(baseCurrency, transactions)
    }

    run()
})()
