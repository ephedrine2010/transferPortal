//------- extract gtin code
	 //barcode or qrcode  will passed by the scanner

  if (barcode.length > 16) {
    
    barcode = barcode.toString().substring(2, 16);
  }

//------------------------------- local db search -----------------------
localDBsearch(String barcode, [bool vatRequired = true]) async {
  var localDb = localSqlDB();
  List result = [];

  //sku
  if (barcode.length == 9) {
    var TT = await localDb.readRawData(
        'select * from localmaster where sku = ${int.parse(barcode)}');
    if (TT == null) {
      var xx = await localDb.readRawData(
          'select * from localmaster where barcode = ${int.parse(barcode)}');
      if (xx != null) result = xx;
    } else {
      result = TT;
    }
  }

  //barcode
  if (barcode.length < 9) {
    var TT = await localDb.readRawData(
        'select * from localmaster where barcode = ${double.parse(barcode)}');
    if (TT != null) result = TT;
  }

  //barcode
  if (barcode.length < 14 && barcode.length > 9) {
    var TT = await localDb.readData(
        'localmaster', 'barcode= ?', num.parse(barcode.toString()));
    if (TT != null) result = TT;
  }

  //barcode
  if (barcode.length > 13) {
    var TT = await localDb
        .readRawData('select * from localmaster where gtin = \'$barcode\'');
    if (TT != null) result = TT;
  }

  itemdataModel xItem = itemdataModel();

  if (result.isNotEmpty) {
    Map<String, dynamic> xRes = <String, dynamic>{};
    xRes = result[0];

    xItem.rms_code = xRes['sku'];

    try {
      if (xRes['gtin'].toString().length > 3) {
        xItem.nat_barcode = double.parse(xRes['gtin'].toString());
      } else {
        xItem.nat_barcode = double.parse(xRes['barcode'].toString());
      }
    } catch (e) {
      xItem.nat_barcode = double.parse(barcode);
    }

    //xItem.nat_barcode = result[0]['barcode'];
    xItem.gtin_barcode = xItem.nat_barcode.toString();
    xItem.eng_name = xRes['name_en'];
    xItem.ar_name = xRes['name_ar'];
    xItem.imgUrl = config.empty_img; //xRes['item_image_link'].toString();
    xItem.vat = xRes['vat'];
    //if price not null
    //num TT = num.parse(result[0]['item_price'].toString());

    if (xRes['item_price'] != null) {
      if (vatRequired) {
        double vattt = double.parse(xRes['vat'].toString()) + 100;

        xItem.item_price = double.parse(
            (double.parse(xRes['item_price'].toString()) * vattt / 100)
                .toStringAsFixed(2));
      } else {
        xItem.item_price = double.parse(xRes['item_price'].toString());
      }
    } else {
      xItem.item_price = 0;
    }
  }

  return xItem;
}

//------------------------------------------
/-------------model------------------------

class itemdataModel {
  int? id;
  int? rms_code;
  double? nat_barcode;
  String? gtin_barcode;
  String? eng_name;
  String? ar_name;
  double? item_price;
  int? vat;
  String? imgUrl;
  int? exp_date;
  String? CatName;
  bool is_smart = false;

  itemdataModel(
      {this.id,
      this.rms_code,
      this.nat_barcode,
      this.gtin_barcode,
      this.eng_name,
      this.ar_name,
      this.item_price,
      this.vat,
      this.exp_date,
      this.imgUrl,
      this.CatName,
      this.is_smart = false});

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['id'] = id;
    data['rms_code'] = rms_code;
    data['nat_barcode'] = nat_barcode;
    data['gtin_barcode'] = gtin_barcode;
    data['eng_name'] = eng_name;
    data['ar_name'] = ar_name;
    data['item_price'] = item_price;
    data['vat'] = vat;
    data['imgUrl'] = imgUrl;
    data['exp_date'] = exp_date;
    data['CatName'] = CatName;
    data['is_smart'] = is_smart;
    return data;
  }

  itemdataModel.fromJson(Map<String, dynamic> json) {
    id = json['id'];
    rms_code = json['rms_code'];
    if (json['nat_barcode'] == null) {
      nat_barcode = 0;
    } else {
      nat_barcode = json['nat_barcode'].toDouble();
    }

    gtin_barcode = json['gtin_barcode'];
    eng_name = json['eng_name'];
    ar_name = json['ar_name'];
    if (json['item_price'] == null) {
      item_price = 0;
    } else {
      item_price = json['item_price'].toDouble();
    }
    vat = json['vat'];
    CatName = json['CatName'];
    exp_date = json['exp_date'];
    imgUrl =
        'https://cdn3.iconfinder.com/data/icons/network-and-communications-10/32/network_Error_lost_no_page_not_found-512.png';
    is_smart = json['is_smart'] ?? false;
  }

  /*
    lstdatat.addAll(response.body);
    for (var element in response.body) {
      lstdatat.add(Datamodel.fromJson(element));
    }
    */
}

--------------------------------------------------------