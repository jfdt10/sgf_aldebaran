import { LanguageService } from '../../services/language.service';
import { inject } from '@angular/core';
import { TranslatePipe } from '../../services/translate.pipe';
import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { LucideAngularModule, Mail, Lock, AlertCircle } from 'lucide-angular';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [TranslatePipe, CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {
  readonly language = inject(LanguageService);

  credenciais = {
    email: '',
    senha: ''
  };

  erroLogin: boolean = false;
  carregando: boolean = false;
  quantidadeFiliais: number = 0;

  readonly icons = {
    mail: Mail,
    lock: Lock,
    alert: AlertCircle
  };

  constructor(
    private authService: AuthService,
    private router: Router,
    private cd: ChangeDetectorRef
  ) { }

  ngOnInit() {
    this.carregarContagemFiliais();
  }

  carregarContagemFiliais() {
    this.authService.getPublicBranchCount().subscribe({
      next: (res: any) => {
        this.quantidadeFiliais = res.count;
        this.cd.detectChanges();
      },
      error: (err) => {
        console.error('Erro ao buscar contagem de filiais:', err);
        this.quantidadeFiliais = 3;
      }
    });
  }

  fazerLogin() {
    const identificador = this.credenciais.email.trim();
    if (!identificador || !this.credenciais.senha) {
      alert(this.language.text("Por favor, preencha todos os campos."));
      return;
    }

    this.carregando = true;
    this.erroLogin = false;

    this.authService.login({ ...this.credenciais, email: identificador }).subscribe({
      next: (resposta: any) => {
        localStorage.removeItem('client_token');
        localStorage.removeItem('client_user');
        localStorage.setItem('token', resposta.token);

        if (resposta.usuario) {
          localStorage.setItem('usuario_nome', resposta.usuario.nome);
          this.authService.setCurrentUser(resposta.usuario);
        }

        const tipoUsuario = resposta.usuario?.tipo;
        switch (tipoUsuario) {
          case 'ADMIN':
            this.router.navigate(['/admin/dashboard']);
            break;
          case 'SUPERVISOR':
            this.router.navigate(['/supervisor/dashboard']);
            break;
          case 'OPERADOR':
            this.router.navigate(['/operador/escolha-guiches']);
            break;
          case 'CLIENTE':
            this.router.navigate(['/client/home']);
            break;
          default:
            this.router.navigate(['/client/home']);
        }

        this.carregando = false;
        this.cd.detectChanges();
      },
      error: (erro: any) => {
        this.carregando = false;
        this.erroLogin = true;

        if (erro.status === 401) {
          alert(this.language.text("Senha incorreta! Verifique suas credenciais."));
        } else {
          alert(this.language.text("Erro ao conectar. Tente novamente."));
        }

        this.cd.detectChanges();
      }
    });
  }
}