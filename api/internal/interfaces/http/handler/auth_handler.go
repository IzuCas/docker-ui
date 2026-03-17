package handler

import (
	"context"

	"github.com/danielgtaylor/huma/v2"

	"app/example/pkg/auth"
	"app/example/pkg/logger"
)

// AuthHandler handles authentication requests
type AuthHandler struct{}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{}
}

// LoginInput is the request body for POST /auth/login
type LoginInput struct {
	Body struct {
		Username string `json:"username" required:"true" minLength:"1"`
		Password string `json:"password" required:"true" minLength:"1"`
	}
}

// LoginOutput is the response for a successful login
type LoginOutput struct {
	Body struct {
		Token                 string `json:"token"`
		Username              string `json:"username"`
		RequirePasswordChange bool   `json:"require_password_change"`
	}
}

// Login validates credentials and returns a JWT token.
// When the credentials are still the initial (default) ones,
// require_password_change is set to true.
func (h *AuthHandler) Login(ctx context.Context, input *LoginInput) (*LoginOutput, error) {
	creds := auth.LoadCredentials()

	if input.Body.Username != creds.Username || input.Body.Password != creds.Password {
		logger.Warn("Failed login attempt", logger.String("username", input.Body.Username))
		return nil, huma.Error401Unauthorized("Invalid username or password")
	}

	token, err := auth.GenerateToken(input.Body.Username)
	if err != nil {
		return nil, huma.Error500InternalServerError("Failed to generate token")
	}

	logger.Info("Successful login",
		logger.String("username", input.Body.Username),
		logger.Bool("require_password_change", creds.IsInitial),
	)

	out := &LoginOutput{}
	out.Body.Token = token
	out.Body.Username = input.Body.Username
	out.Body.RequirePasswordChange = creds.IsInitial
	return out, nil
}

// ChangePasswordInput is the request body for POST /auth/change-password
type ChangePasswordInput struct {
	Body struct {
		CurrentPassword string `json:"current_password" required:"true" minLength:"1"`
		NewPassword     string `json:"new_password" required:"true" minLength:"8"`
		NewUsername     string `json:"new_username,omitempty"`
	}
}

// ChangePasswordOutput is the response for a successful password change
type ChangePasswordOutput struct {
	Body struct {
		Message string `json:"message"`
	}
}

// ChangePassword validates the current password and persists the new one.
// Requires a valid JWT (protected route).
func (h *AuthHandler) ChangePassword(ctx context.Context, input *ChangePasswordInput) (*ChangePasswordOutput, error) {
	creds := auth.LoadCredentials()

	if input.Body.CurrentPassword != creds.Password {
		return nil, huma.Error401Unauthorized("Current password is incorrect")
	}

	newUsername := creds.Username
	if u := input.Body.NewUsername; u != "" {
		newUsername = u
	}

	if err := auth.SaveCredentials(newUsername, input.Body.NewPassword); err != nil {
		logger.Error("Failed to save credentials", logger.Err(err))
		return nil, huma.Error500InternalServerError("Failed to update credentials")
	}

	logger.Info("Credentials updated",
		logger.String("username", newUsername),
	)

	out := &ChangePasswordOutput{}
	out.Body.Message = "Credentials updated successfully"
	return out, nil
}

// MeInput is the request for GET /auth/me
type MeInput struct {
	Authorization string `header:"Authorization"`
}

// MeOutput is the response for GET /auth/me
type MeOutput struct {
	Body struct {
		Username string `json:"username"`
	}
}

// Me returns the current authenticated user info from the JWT
func (h *AuthHandler) Me(ctx context.Context, input *MeInput) (*MeOutput, error) {
	parts := splitBearer(input.Authorization)
	if parts == "" {
		return nil, huma.Error401Unauthorized("Missing token")
	}
	claims, err := auth.ValidateToken(parts)
	if err != nil {
		return nil, huma.Error401Unauthorized("Invalid token")
	}
	out := &MeOutput{}
	out.Body.Username = claims.Username
	return out, nil
}

func splitBearer(header string) string {
	if len(header) > 7 && header[:7] == "Bearer " {
		return header[7:]
	}
	return ""
}
