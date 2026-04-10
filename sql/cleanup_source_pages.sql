DELETE FROM leads
WHERE
  discovery_source LIKE 'expanded_from:%'
  AND (
    website_url LIKE 'https://%.hipages.com.au%'
    OR website_url LIKE 'https://%.truelocal.com.au%'
    OR website_url LIKE 'https://%.yellowpages.com.au%'
    OR website_url LIKE 'http://%.hipages.com.au%'
    OR website_url LIKE 'http://%.truelocal.com.au%'
    OR website_url LIKE 'http://%.yellowpages.com.au%'
  );
