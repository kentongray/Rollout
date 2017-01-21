import {Platform, NavController, Loading, LoadingController, Content, ToastController} from "ionic-angular";
import {AddressLookup} from "../../common/AddressLookup";
import {Scheduler, PickupDay} from "../../common/Scheduler";
import {Geolocation} from "ionic-native";
import moment from "moment";
import {RemindMePage} from "../remindme/RemindMePage";
import {Component, ViewChild} from "@angular/core";
import {rejectFirst, HandledPromiseError} from "../../common/PromiseExceptionHandler";
import {DetailPage} from "../detail/DetailPage";
import {UrlUtil} from "../../common/UrlUtil";
import {TranslateService} from "ng2-translate";

@Component({
  templateUrl: 'HomePage.html'
})
export class HomePage {
  @ViewChild(Content) content: Content;
  private coords;
  private geolocation:any;
  private pickupDays:PickupDay;
  private addressLookup;

  moment;
  addresses;
  searching:Boolean;
  events = [];
  errorMessage?:string;
  loadingContent:Loading;
  loading:boolean;
  currentSearch:string;
  translatedText = {};

  constructor(
      public toastCtrl: ToastController,
      private loadingController:LoadingController,
      private platform:Platform,
      private nav:NavController,
      private SchedulerService:Scheduler,
      addressLookup:AddressLookup,
      translate:TranslateService
  ) {
    this.moment = moment;
    this.geolocation = Geolocation;
    this.addressLookup = addressLookup;
    this.announceUpdates();
    this.loadEvents();
    translate.get([
      'We_Had_A_Problem_Loading_Your_Schedule_The_City_Of_Houston_May_Be_Having_Issues',
      'You_Can_Now_Tap_The_Types_Of_Trash_To_Learn_More',
      'Looking_Up_Coordinates',
      'Unable_To_Locate_You',
      'Looking_Up_Your_Schedule',
      'Error_Loading_Events',
      'Starting_Up',
      'Finding_Your_Location',
      'We_Couldnt_Look_Up_Your_Location_Check_Your_Location_Permissions',
      'Something_Went_Wrong',
      'Error_Finding_Position',
      'Try_Again',
      'One_Sec',
    ]).subscribe(res => {
      this.translatedText['errorLoading'] = res['We_Had_A_Problem_Loading_Your_Schedule_The_City_Of_Houston_May_Be_Having_Issues'];
      this.translatedText['youCanNowTapTheTypesOfTrashToLearnMore'] = res['You_Can_Now_Tap_The_Types_Of_Trash_To_Learn_More'];
      this.translatedText['lookingUpCoordinates'] = res['Looking_Up_Coordinates'];
      this.translatedText['unableToLocateYou'] = res['Unable_To_Locate_You'];
      this.translatedText['lookingUpYourSchedule'] = res['Looking_Up_Your_Schedule'];
      this.translatedText['errorLoadingEvents'] = res['Error_Loading_Events'];
      this.translatedText['startingUp'] = res['Starting_Up'];
      this.translatedText['findingYourLocation'] = res['Finding_Your_Location'];
      this.translatedText['weCouldntLookUpYourLocationCheckYourLocationPermissions'] = res['We_Couldnt_Look_Up_Your_Location_Check_Your_Location_Permissions'];
      this.translatedText['somethingWentWrong'] = res['Something_Went_Wrong'];
      this.translatedText['errorFindingPosition'] = res['Error_Finding_Position'];
      this.translatedText['tryAgain'] = res['Try_Again'];
      this.translatedText['oneSec'] = res['One_Sec'];
    });
  }

  announceUpdates() {
    if(!window.localStorage.getItem('announcedTapTypes')) {
      window.localStorage.setItem('announcedTapTypes', true.toString());
      let toast = this.toastCtrl.create({
        message: this.translatedText['youCanNowTapTheTypesOfTrashToLearnMore'],
        showCloseButton: true,
        duration: 20000,
      });
      toast.present();
    }
  }

  openHolidaySchedule() {
    UrlUtil.openUrl('http://www.houstontx.gov/solidwaste/holiday.html');
  }
  showFilterBar() {
    this.content.scrollToTop();
    this.searching = true;
  }

  lookupCurrentLocation() {
    this.searching = false;
    this.addresses = null;
    this.loadEvents();
  }

  selectAddress(suggestion) {
    this.searching = false;
    this.addresses = null;
    this.showLoader(this.translatedText['lookingUpCoordinates']);
    this.addressLookup.lookupCoordinates(suggestion)
      .then(r => {
        this.showLoader(this.translatedText['lookingUpYourSchedule']);
        return this.loadEventsForPosition(r);
      }, e => this.showError(this.translatedText['unableToLocateYou']))
      .then(r => {
        this.hideLoader();
        return r;
      }, e => this.showError(this.translatedText['errorLoadingEvents']))
      .catch(e => {
        this.hideLoader();
        throw "Error Loading Events";
      });
  }

  searchAddress(str) {
    console.log('searching for ', str);
    if (str.length <= 2) {
      this.addresses = null;
      return;
    }
    this.currentSearch = str;
    this.addressLookup.lookupAddress(str).then((results) => {
      //deal with variable loading times, we create a token to make sure we are only showing the latest results
      if (str === this.currentSearch) {
        console.log('address results', results, str, this.currentSearch);
        this.addresses = results;
      }
      else {
        console.log('ignoring slow result', str, this.currentSearch);
      }
    });
  }

  goToDetails(category) {
    console.log(category, 'category go!');
    this.nav.push(DetailPage, {
      category: category
    });
  }

  goToRemindMe() {
    this.nav.push(RemindMePage, {
      latitude: this.coords.latitude,
      longitude: this.coords.longitude,
    });
  }

  static dayOfWeek(day) {
    return moment().day(day).format("dddd");
  }

  showLoader(str = this.translatedText['oneSec']) {
    if (!this.loadingContent) {
      this.loadingContent = this.loadingController.create({content: str});
    }

    //hack see: https://github.com/driftyco/ionic/issues/6103
    this.loadingContent.data.content = str;
    if (!this.loading) {
      this.loadingContent.present();
      this.loading = true;
    }
  }

  hideLoader() {
    this.loading = false;
    if (this.loadingContent) {
      this.loadingContent.dismiss();
      this.loadingContent = null;
    }
  }

  loadEvents() {
    this.showLoader(this.translatedText['startingUp']);
    return this.platform.ready().then(() => {
      this.showLoader(this.translatedText['findingYourLocation']);
      return this.geolocation.getCurrentPosition()
        .then(pos => {
          this.showLoader(this.translatedText['lookingUpSchedule']);
          return pos;
        })
        .catch(rejectFirst(this.translatedText['weCouldntLookUpYourLocationCheckYourLocationPermissions']))
        .then(this.loadEventsForPosition.bind(this))
        .catch(rejectFirst(this.translatedText['errorLoading']));
    }).then(this.hideLoader.bind(this), this.promiseCatcher);
  }

  // meant to be used in conjunction with promise utils to display the error of the first promise
  // written in this way to bind(this)
  promiseCatcher = (error:any):void => {
      console.log('error happened?', error);
      if (error instanceof HandledPromiseError) {
        this.showError(error.message)
      }
      else {
        this.showError(this.translatedText['somethingWentWrong']);
      }
      this.hideLoader.bind(this)
  };


  errorFindingPosition(err) {
    this.showError(this.translatedText['errorFindingPosition']);
    console.error('Error Finding Position', err);
  }

  showError(errorMessage) {
    console.error(errorMessage, this.errorFindingPosition.bind(this));
    this.hideLoader();
    this.errorMessage = errorMessage;
  }

  clearError():void {
    this.hideLoader();
    this.errorMessage = null;
  }

  retry():Promise<Array<any>> {
    this.showLoader(this.translatedText['tryAgain']);
    this.clearError();
    console.log('reloading', this.coords);
    if(!this.coords) {
      //if no coords try to geolocate again
      return this.loadEvents();
    }
    else {
      //they might have put in a custom address so try to look up the same ones
      return this.loadEventsForPosition({coords: this.coords})
        .catch(rejectFirst(this.translatedText['errorLoading']))
        .then(r => {
          this.hideLoader();
          return r
        }, this.promiseCatcher);
    }
  }

  loadEventsForPosition(pos):Promise<Array<any>> {
    //data format from arcgis is all over the place, need to standardize this to prevent headaches :-/
    if (pos.x && !pos.coords) {
      pos.coords = {
        latitude: pos.y,
        longitude: pos.x
      };

    }
    this.coords = pos.coords;
    this.SchedulerService.init(pos, 90);

    return this.SchedulerService.whenLoaded.then(() => {
      this.events = this.SchedulerService.events;
      this.pickupDays = this.SchedulerService.pickupDays;
      this.hideLoader();
      return this.events;
    });
  }
}
