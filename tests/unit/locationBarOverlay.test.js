var orig = {};
utils.include('../../content/xulmigemo/core.js', orig, 'Shift_JIS');
utils.include('../../content/xulmigemo/places/places.js', orig, 'Shift_JIS');
utils.include('../../content/xulmigemo/places/locationBarOverlay.js', null, 'Shift_JIS');

var XMigemoCore;
var XMigemoPlaces;
var searchSource;
var service;

function setUp()
{
	XMigemoCore = {};
	XMigemoCore.__proto__ = orig.XMigemoCore;

	XMigemoPlaces = {};
	XMigemoPlaces.__proto__ = orig.XMigemoPlaces;

	service = {};
	service.__proto__ = XMigemoLocationBarOverlay;

	searchSource = {};
	searchSource.__proto__ = XMigemoLocationBarSearchSource;

	XMigemoPlaces.findHistoryKey = '^';
	XMigemoPlaces.findBookmarksKey = '*';
	XMigemoPlaces.findTaggedKey = '+';
	XMigemoPlaces.findTitleKey = '@';
	XMigemoPlaces.findURIKey = '#';
	XMigemoPlaces.updateFindKeyRegExp();

	XMigemoPlaces.defaultBehavior = 0;
	XMigemoPlaces.autoStartRegExpFind = true;
}

function tearDown()
{
}

function test_findSources()
{
	for (var i in service.sources)
	{
		let source = service.sources[i];
		assert.isFunction(source.isAvailable, i);
		assert.isFunction(source.getSourceSQL, i);
		assert.isFunction(source.getSourceBindingFor, i);
		assert.isFunction(source.getItemsSQL, i);
		assert.isFunction(source.getItemsBindingFor, i);
		assert.isFunction(source.itemFilter, i);
	}
}

function test_findSource_KEYWORD_SEARCH()
{
	var source = service.sources.KEYWORD_SEARCH;

	var result;
	result = source.formatInput('keyword term');
	assert.equals('keyword', result.keyword);
	assert.equals('term', result.terms);

	result = source.formatInput('language C++ JavaScript Ruby ');
	assert.equals('language', result.keyword);
	assert.equals('C%2B%2B+JavaScript+Ruby', result.terms);

	assert.equals(['keyword', 'terms'], source.getSourceBindingFor('keyword terms'));
	assert.equals(['keyword', 'terms'], source.getItemsBindingFor('keyword terms'));

	assert.isFunction(source.termsGetter);
	assert.equals(['keyword', 'terms'], source.termsGetter('keyword terms', 'keyword terms'));

	assert.isFunction(source.exceptionsGetter);
	assert.equals([], source.exceptionsGetter('keyword terms'));

	assert.equals('keyword', source.style);

	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
}

function test_findSource_INPUT_HISTORY()
{
	var source = service.sources.INPUT_HISTORY;

	assert.equals(['input'], source.getSourceBindingFor('input'));
	assert.equals(['input'], source.getItemsBindingFor('input'));

	assert.isNotFunction(source.termsGetter);
	assert.isNotFunction(source.exceptionsGetter);

	assert.isNull(source.style);

	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
}

function test_findSource_MATCHING_BOUNDARY()
{
	var source = service.sources.MATCHING_BOUNDARY;

	assert.isNull(source.style);

	XMigemoPlaces.boundaryFindAvailable = true;
	XMigemoPlaces.matchBehavior = 0;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 1;
	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 2;
	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 3;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));

	XMigemoPlaces.boundaryFindAvailable = false;
	XMigemoPlaces.matchBehavior = 0;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 1;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 2;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 3;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));

	var item = {
			title : 'にほんご日本語ニホンゴnihongo',
			uri   : 'http://www.example.com/'
		};
	assert.equals(service.kITEM_ACCEPT, source.itemFilter(item, ['にほん'], 0));
	assert.equals(service.kITEM_ACCEPT, source.itemFilter(item, ['にほん', '日本'], 0));
	assert.equals(service.kITEM_ACCEPT, source.itemFilter(item, ['にほん', 'example'], 0));
	assert.equals(service.kITEM_DEFERED, source.itemFilter(item, ['ほん'], 0));
	assert.equals(service.kITEM_DEFERED, source.itemFilter(item, ['にほん', '本'], 0));
	assert.equals(service.kITEM_DEFERED, source.itemFilter(item, ['にほん', 'xam'], 0));
}

function test_findSource_MATCHING_ANYWHERE()
{
	var source = service.sources.MATCHING_ANYWHERE;

	assert.isNull(source.style);

	XMigemoPlaces.boundaryFindAvailable = true;
	XMigemoPlaces.matchBehavior = 0;
	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 1;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 2;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 3;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));

	XMigemoPlaces.boundaryFindAvailable = false;
	XMigemoPlaces.matchBehavior = 0;
	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 1;
	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 2;
	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isTrue(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 3;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
}

function test_findSource_MATCHING_START()
{
	var source = service.sources.MATCHING_START;

	assert.isNull(source.style);

	XMigemoPlaces.matchBehavior = 0;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 1;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 2;
	assert.isFalse(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));
	XMigemoPlaces.matchBehavior = 3;
	assert.isTrue(source.isAvailable(service.FIND_MODE_MIGEMO));
	assert.isFalse(source.isAvailable(service.FIND_MODE_REGEXP));

	var item = {
			title : 'にほんご日本語ニホンゴnihongo',
			uri   : 'http://www.example.com/'
		};
	assert.equals(service.kITEM_ACCEPT, source.itemFilter(item, ['にほん'], 0));
	assert.equals(service.kITEM_SKIP, source.itemFilter(item, ['ほん'], 0));
	assert.equals(service.kITEM_SKIP, source.itemFilter(item, ['日本'], 0));
	assert.equals(service.kITEM_ACCEPT, source.itemFilter(item, ['http'], 0));
	assert.equals(service.kITEM_SKIP, source.itemFilter(item, ['example'], 0));
	assert.equals(service.kITEM_ACCEPT, source.itemFilter(item, ['にほん', 'http'], 0));
	assert.equals(service.kITEM_SKIP, source.itemFilter(item, ['にほん', 'example'], 0));
}

function test_findItemsFromRange()
{
}

function test_findItemsFromRangeByTerms()
{
}
