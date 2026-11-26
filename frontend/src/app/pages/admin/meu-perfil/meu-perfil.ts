import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, User, Shield, Save } from 'lucide-angular';
import { TranslatePipe } from '../../../services/translate.pipe';
import { ApiService } from '../../../services/api.service';
import { AuthService, AuthenticatedUser } from '../../../services/auth.service';

@Component({
  selector: 'app-meu-perfil',
  standalone: true,
  imports: [TranslatePipe, FormsModule, LucideAngularModule],
  templateUrl: './meu-perfil.html',
  styleUrls: ['./meu-perfil.scss']
})
export class MeuPerfil {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  readonly usuario = this.auth.getCurrentUser();
  readonly icons = { user: User, shield: Shield, save: Save };

  nome = this.usuario?.nome ?? '';
  email = this.usuario?.email ?? '';
  senhaAtual = '';
  senha = '';
  confirmacao = '';
  readonly savingProfile = signal(false);
  readonly savingPassword = signal(false);
  readonly profileStatus = signal('');
  readonly passwordStatus = signal('');

  salvarPerfil(): void {
    if (!this.usuario?.id || !this.nome.trim() || !this.email.trim() || this.savingProfile()) return;

    this.profileStatus.set('');
    this.savingProfile.set(true);
    this.api.put<AuthenticatedUser>(`/usuarios/${this.usuario.id}`, {
      nome: this.nome.trim(),
      email: this.email.trim(),
    }).subscribe({
      next: (updated) => {
        this.auth.setCurrentUser({ ...this.usuario, ...updated });
        this.profileStatus.set('Perfil atualizado com sucesso.');
        this.savingProfile.set(false);
      },
      error: (error) => {
        this.profileStatus.set(error.status === 409 || (error.status === 400 && /em uso/.test(error.error?.message ?? '')) ? 'Este e-mail já está em uso.' : 'Não foi possível salvar o perfil.');
        this.savingProfile.set(false);
      },
    });
  }

  alterarSenha(): void {
    if (!this.senhaAtual || this.senha.length < 8 || this.savingPassword()) return;
    if (this.senha !== this.confirmacao) {
      this.passwordStatus.set('As senhas não coincidem.');
      return;
    }

    this.passwordStatus.set('');
    this.savingPassword.set(true);
    this.api.patch('/usuarios/me/senha', { senhaAtual: this.senhaAtual, senha: this.senha }).subscribe({
      next: () => {
        this.senhaAtual = this.senha = this.confirmacao = '';
        this.passwordStatus.set('Senha alterada com sucesso.');
        this.savingPassword.set(false);
      },
      error: (error) => {
        this.passwordStatus.set(error.status === 403 ? 'Senha atual incorreta.' : 'Não foi possível alterar a senha.');
        this.savingPassword.set(false);
      },
    });
  }
}