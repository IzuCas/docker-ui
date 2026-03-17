package auth

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// Credentials holds the current login credentials and whether they are the
// initial (default) ones that should be changed after the first login.
type Credentials struct {
	Username  string `json:"username"`
	Password  string `json:"password"`
	IsInitial bool   `json:"is_initial"`
}

func credentialsFilePath() string {
	if p := os.Getenv("CREDENTIALS_FILE"); p != "" {
		return p
	}
	return "./data/credentials.json"
}

// LoadCredentials loads stored credentials from the credentials file.
// If the file does not exist or is unreadable, it falls back to the
// AUTH_USERNAME / AUTH_PASSWORD env vars (default: guest / guest) and
// marks the credentials as initial so the user is prompted to change them.
func LoadCredentials() Credentials {
	path := credentialsFilePath()
	data, err := os.ReadFile(path)
	if err == nil {
		var creds Credentials
		if json.Unmarshal(data, &creds) == nil {
			return creds
		}
	}

	username := os.Getenv("AUTH_USERNAME")
	if username == "" {
		username = "guest"
	}
	password := os.Getenv("AUTH_PASSWORD")
	if password == "" {
		password = "guest"
	}
	return Credentials{Username: username, Password: password, IsInitial: true}
}

// SaveCredentials persists new credentials to the credentials file and marks
// them as non-initial (password-change prompt will not appear again).
func SaveCredentials(username, password string) error {
	creds := Credentials{
		Username:  username,
		Password:  password,
		IsInitial: false,
	}
	data, err := json.MarshalIndent(creds, "", "  ")
	if err != nil {
		return err
	}
	path := credentialsFilePath()
	if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0600)
}
