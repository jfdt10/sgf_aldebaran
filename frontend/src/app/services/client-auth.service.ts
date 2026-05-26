import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ClientAuthService {
  private apiUrl = `${environment.apiUrl}/auth/client`; 

  constructor(private http: HttpClient) {}

  signup(dados: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/signup`, dados);
  }

  login(email: string, senha: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, { email, senha });
  }
}