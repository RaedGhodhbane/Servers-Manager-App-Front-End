import { ChangeDetectionStrategy, Component, OnInit } from '@angular/core';
import { Observable, map, startWith, catchError, of, BehaviorSubject } from 'rxjs';
import { DataState } from './enum/data-state.enum';
import { AppState } from './interface/app-state';
import { CustomResponse } from './interface/custom-response';
import { ServerService } from './service/server.service';
import { Status } from './enum/status.enum';
import { NgForm } from '@angular/forms';
import { Server } from './interface/server';
import { NotificationService } from './service/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  //changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  appState$!: Observable<AppState<CustomResponse>> 
  readonly DataState = DataState;
  readonly Status = Status;
  private filterSubject = new BehaviorSubject<string>('');
  private dataSubject = new BehaviorSubject<CustomResponse | null>(null);
  filterStatus$ = this.filterSubject.asObservable();
  private isLoading = new BehaviorSubject<boolean>(false);
  isLoading$ = this.isLoading.asObservable();

  constructor(private serverService: ServerService, private notifier: NotificationService) {
  }

  ngOnInit(): void {
    this.appState$ = this.serverService.servers$ // appState$ in an Observable ( because we used the $ sign)
      .pipe(
        map(response => {
          this.notifier.onDefault(response.message);
          this.dataSubject.next(response);
          return { dataState: DataState.LOADED_STATE, appData: {...response, data : { servers : response.data.servers?.reverse()}} }
        }),
        startWith({ dataState: DataState.LOADING_STATE }),
        catchError((error: string) => {
          this.notifier.onError(error);
          return of({ dataState: DataState.ERROR_STATE, error })
        })
      );
  }

  pingServer(ipAddress: string): void {
    this.filterSubject.next(ipAddress);
    this.appState$ = this.serverService.ping$(ipAddress)
      .pipe(
        map(response => {
          const servers = (this.dataSubject.value?.data?.servers) || [];
          const index = servers.findIndex(server => server.id === response.data.server?.id);
          if (index !== -1 && response.data.server) {
            servers[index] = response.data.server;
          }
          this.notifier.onDefault(response.message);
          this.filterSubject.next('');
          return { dataState: DataState.LOADED_STATE, appData: this.dataSubject.value as CustomResponse }
        }),
        startWith({ dataState: DataState.LOADED_STATE, appData: this.dataSubject.value as CustomResponse }),
        catchError((error: string) => {
          this.filterSubject.next('');
          this.notifier.onError(error);
          return of({ dataState: DataState.ERROR_STATE, error });
        })
      );
  }

  saveServer(serverForm: NgForm): void {
    this.isLoading.next(true);
    this.appState$ = this.serverService.save$(serverForm.value as Server)
      .pipe(
        map(response => {
          const server = response.data.server;
          if (server) {
            const servers = this.dataSubject.value?.data.servers || [];
            this.dataSubject.next({
              ...response,
              data: { servers: [server, ...servers] }
            });
          }
          this.notifier.onDefault(response.message);
          document.getElementById('closeModal')?.click();
          this.isLoading.next(false);
          serverForm.resetForm({ status: this.Status.SERVER_DOWN });
          return { dataState: DataState.LOADED_STATE, appData: this.dataSubject.value as CustomResponse }
        }),
        startWith({ dataState: DataState.LOADED_STATE, appData: this.dataSubject.value as CustomResponse }),
        catchError((error: string) => {
          this.isLoading.next(false);
          this.notifier.onError(error);
          return of({ dataState: DataState.ERROR_STATE, error });
        })
      );
  }
  
  filterServers(status: Status): void {
    this.appState$ = this.serverService.filter$(status, this.dataSubject.value as CustomResponse)
      .pipe(
        map(response => {
          this.notifier.onDefault(response.message);
          return { dataState: DataState.LOADED_STATE, appData: response }
        }),
        startWith({ dataState: DataState.LOADED_STATE, appData: this.dataSubject.value as CustomResponse }),
        catchError((error: string) => {
          this.notifier.onError(error);
          return of({ dataState: DataState.ERROR_STATE, error });
        })
      );
  }
  
  deleteServer(server: Server): void {
    this.appState$ = this.serverService.delete$(server.id)
      .pipe(
        map(response => {
          this.dataSubject.next(
            {...response, data: 
              {servers: this.dataSubject.value?.data.servers?.filter(s => s.id !== server.id)}}
          );
          this.notifier.onDefault(response.message);
          return { dataState: DataState.LOADED_STATE, appData: this.dataSubject.value as CustomResponse }
        }),
        startWith({ dataState: DataState.LOADED_STATE, appData: this.dataSubject.value as CustomResponse }),
        catchError((error: string) => {
          this.notifier.onError(error);
          return of({ dataState: DataState.ERROR_STATE, error });
        })
      );
  }

  printReport(): void {
    // window.print();
    this.notifier.onDefault('Report downloaded');
    let dataType = 'application/vnd.ms-excel.sheet.macroEnabled.12';
    let tableSelect = document.getElementById('servers');
    let tableHtml = tableSelect?.outerHTML.replace(/ /g, '%20');
    if (tableHtml) {
      let downloadLink = document.createElement('a');
      document.body.appendChild(downloadLink);
      downloadLink.href = 'data:' + dataType + ',' + tableHtml;
      downloadLink.download = 'server-report.xls';
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } else {
      console.error('Table HTML is undefined.');
    }
  }
  
  
  
}
