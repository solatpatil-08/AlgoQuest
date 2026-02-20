from django import forms
from django.contrib.auth import password_validation
from django.contrib.auth.forms import AuthenticationForm, PasswordResetForm, SetPasswordForm
from django.contrib.auth.models import User
from django.contrib.auth.forms import UserCreationForm

from .models import UserProfile


class SignUpForm(UserCreationForm):
    email = forms.EmailField(required=True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password1', 'password2')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['username'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Choose a username'})
        self.fields['email'].widget.attrs.update({'class': 'form-control', 'placeholder': 'name@example.com'})
        self.fields['password1'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Create a password'})
        self.fields['password2'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Confirm password'})
        self.fields['password1'].help_text = password_validation.password_validators_help_text_html()
        self.fields['password2'].help_text = 'Re-enter the same password for confirmation.'

    def clean_email(self):
        email = self.cleaned_data['email'].strip().lower()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('An account with this email already exists.')
        return email


class CustomAuthenticationForm(AuthenticationForm):
    username = forms.CharField(
        label='Username or Email',
        widget=forms.TextInput(attrs={'class': 'form-control', 'placeholder': 'Enter username or email'}),
    )
    password = forms.CharField(
        label='Password',
        strip=False,
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'placeholder': 'Enter password'}),
    )

    def clean(self):
        username_or_email = self.cleaned_data.get('username', '').strip()
        if '@' in username_or_email:
            user = User.objects.filter(email__iexact=username_or_email).only('username').first()
            if user:
                self.cleaned_data['username'] = user.username
        return super().clean()


class CustomPasswordResetForm(PasswordResetForm):
    email = forms.EmailField(
        label='Email',
        max_length=254,
        widget=forms.EmailInput(attrs={'class': 'form-control', 'placeholder': 'name@example.com'}),
    )


class CustomSetPasswordForm(SetPasswordForm):
    def __init__(self, user, *args, **kwargs):
        super().__init__(user, *args, **kwargs)
        self.fields['new_password1'].widget.attrs.update({'class': 'form-control', 'placeholder': 'New password'})
        self.fields['new_password2'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Confirm new password'})
        self.fields['new_password1'].help_text = password_validation.password_validators_help_text_html()


class UserSettingsForm(forms.ModelForm):
    class Meta:
        model = User
        fields = ('email', 'first_name', 'last_name')

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields['email'].widget.attrs.update({'class': 'form-control', 'placeholder': 'name@example.com'})
        self.fields['first_name'].widget.attrs.update({'class': 'form-control', 'placeholder': 'First name'})
        self.fields['last_name'].widget.attrs.update({'class': 'form-control', 'placeholder': 'Last name'})

    def clean_email(self):
        email = self.cleaned_data.get('email', '').strip().lower()
        if not email:
            return email

        email_exists = (
            User.objects.filter(email__iexact=email)
            .exclude(pk=self.instance.pk)
            .exists()
        )
        if email_exists:
            raise forms.ValidationError('An account with this email already exists.')
        return email


class UserProfileForm(forms.ModelForm):
    class Meta:
        model = UserProfile
        fields = (
            'bio',
            'coding_interests',
            'preferred_language',
            'experience_level',
        )
        widgets = {
            'bio': forms.Textarea(
                attrs={
                    'class': 'form-control',
                    'rows': 4,
                    'maxlength': 300,
                    'placeholder': 'Write a short coding bio (max 300 characters).',
                }
            ),
            'coding_interests': forms.TextInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': 'e.g., Graphs, Dynamic Programming, Trees',
                    'maxlength': 200,
                }
            ),
            'preferred_language': forms.TextInput(
                attrs={
                    'class': 'form-control',
                    'placeholder': 'e.g., Python, Java, C++',
                    'maxlength': 40,
                }
            ),
            'experience_level': forms.Select(
                attrs={
                    'class': 'form-control',
                }
            ),
        }

    def clean_bio(self):
        return self.cleaned_data.get('bio', '').strip()

    def clean_coding_interests(self):
        return self.cleaned_data.get('coding_interests', '').strip()

    def clean_preferred_language(self):
        return self.cleaned_data.get('preferred_language', '').strip()
